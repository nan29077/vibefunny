import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { getDb, peekDb, tx } from "../db";
import { genId, decryptSensitive } from "../crypto";
import { storage } from "../storage";
import { audit, notifyUser } from "../services";
import { notifyAdmins } from "../campaign-workflow";
import { captureFunny, FunnyError, holdFunny, releaseFunny, formatFunny } from "../funny";
import type { AiCapability, AiJob, AiJobKind, AiModel, AiProvider, Database, Profile, ShortsProject, ShortsShot } from "../schema";
import { VOICES, type AiInput, type AiResult, type RunOutcome } from "./providers";
import { download, VendorError } from "./http";
import { costWonFor, funnyFor, musicSeconds, unitsFor } from "./pricing";
import { aiShortsAccess, blockedTermInAny, CAPABILITY_LABELS, getAiShortsSettings, kstDayStartIso, kstMonthKey, kstMonthStartIso } from "./settings";
import { adapterFor, capabilityStatus, modelUsable, providerKindOf, resolveModel } from "./readiness";
import { imagePrompt, parseScript, scriptPrompt, ScriptParseError, videoPrompt } from "./prompts";
import { ffmpegPath, MediaError, probeMedia, sniffMime } from "./media";
import { composeShorts, type ComposeShot } from "./compose";
import { vibeOnlyError, VIBE_ONLY_MESSAGE } from "../membership";

// ===========================================================================
// AI 숏츠 작업 엔진 (숏핑 server/ai/engine.mjs 의 구조를 JSON DB 용으로 이식)
//   등록(tx): 이용 가능 여부 → 한도 → 퍼니 예약 → 대기열
//   처리(비동기): 작업 잡기(tx, 임대) → 공급사 호출/결과 확인(tx 밖) → 파일 저장 → 정산(tx)
//   성공: 실제 사용량만 차감하고 나머지 반환 / 실패: 다시 시도 또는 전액 반환
// - 모든 상태 변경은 db.tx() (파일 잠금 + 원자적 저장) 안에서 한다 → 같은 서버의 여러 프로세스도 안전
// - 스위치를 꺼도 이미 등록된 작업은 끝까지 처리한다 (새 등록만 막음)
// ===========================================================================

export class AiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const iso = () => new Date().toISOString();
const ACTIVE: AiJob["status"][] = ["queued", "running"];
const POLL_MS: Partial<Record<AiCapability, number>> = { video: 8_000, music: 4_000 };
const DEADLINE_MS: Record<AiJobKind, number> = {
  script: 10 * 60_000,
  shot_image: 10 * 60_000,
  shot_tts: 10 * 60_000,
  music: 15 * 60_000,
  shot_video: 30 * 60_000,
  compose: 20 * 60_000,
};
const RUN_LEASE_MS = 6 * 60_000; // 공급사 호출 최대 시간보다 길게
const POLL_LEASE_MS = 2 * 60_000;
const COMPOSE_LEASE_MS = 15 * 60_000;
const MAX_ATTEMPTS = 3;
const BREAKER_FAILURES = 5;
const BREAKER_COOLDOWN_MS = 10 * 60_000;
/** 실행 중인 작업의 임대를 이 간격으로 연장한다 (heartbeat) */
const HEARTBEAT_MS = 30_000;
/** 마지막 heartbeat 가 이보다 오래되면 그 워커는 죽은 것으로 보고 작업을 회수한다 */
const HEARTBEAT_STALE_MS = 2 * 60_000;
/** 공급사 사용 중지(차단기) 중인 작업은 최대 이 간격마다 다시 확인한다 (관리자가 중지를 풀면 곧 이어서 처리) */
const COOLDOWN_RECHECK_MS = 60_000;

/** 월 예산 이중 집계 방지: 이 시도(attempts)의 공급사 비용을 이미 vendor_cost_won 에 기록했는지 */
type CostTrackedJob = AiJob & { cost_recorded_attempt?: number };

function leaseMsFor(j: Pick<AiJob, "kind" | "vendor_ref">): number {
  return j.kind === "compose" ? COMPOSE_LEASE_MS : j.vendor_ref ? POLL_LEASE_MS : RUN_LEASE_MS;
}

/** 공급사가 연속 실패로 사용 중지(cooldown) 중이면 그 해제 시각(ms), 아니면 null */
function providerCooldownUntil(db: Database, modelRef: string | null): number | null {
  if (!modelRef) return null;
  const model = (db.ai_models ?? []).find((m) => m.id === modelRef);
  const provider = model ? (db.ai_providers ?? []).find((p) => p.id === model.provider_id) : undefined;
  const until = provider?.cooldown_until ? Date.parse(provider.cooldown_until) : NaN;
  return Number.isFinite(until) && until > Date.now() ? until : null;
}

// --- ffmpeg 준비 여부 (음성 길이 확인·합성에 필요) ------------------------------------
let ffmpegCache: { ok: boolean; at: number } | null = null;
/** ffmpeg 실행 가능 여부 (성공은 10분, 실패는 30초 동안 기억) */
export function ffmpegAvailable(): Promise<boolean> {
  const ttl = ffmpegCache?.ok ? 10 * 60_000 : 30_000;
  if (ffmpegCache && Date.now() - ffmpegCache.at < ttl) return Promise.resolve(ffmpegCache.ok);
  return new Promise((resolve) => {
    try {
      execFile(ffmpegPath(), ["-hide_banner", "-version"], { timeout: 10_000, windowsHide: true }, (error) => {
        ffmpegCache = { ok: !error, at: Date.now() };
        resolve(!error);
      });
    } catch {
      ffmpegCache = { ok: false, at: Date.now() };
      resolve(false);
    }
  });
}
/** 마지막 확인에서 ffmpeg 가 없었는가 (동기 — 등록 tx 안에서 사용) */
function ffmpegKnownMissing(): boolean {
  return !!ffmpegCache && !ffmpegCache.ok && Date.now() - ffmpegCache.at < 30_000;
}
const FFMPEG_MISSING_TTS = "음성 길이를 확인할 도구(ffmpeg)가 서버에 준비되지 않아 음성을 만들 수 없습니다. 관리자에게 문의해 주세요.";

export function aiTables(db: Database) {
  if (!db.ai_providers) db.ai_providers = [];
  if (!db.ai_models) db.ai_models = [];
  if (!db.ai_jobs) db.ai_jobs = [];
  if (!db.shorts_projects) db.shorts_projects = [];
  return { providers: db.ai_providers, models: db.ai_models, jobs: db.ai_jobs, projects: db.shorts_projects };
}

// 준비 상태 함수는 readiness.ts 로 옮겼다 (settings.ts 와의 순환 참조 방지). 기존 import 경로 호환용 재내보내기.
export { adapterFor, capabilityStatus, modelUsable, resolveModel };

/** 지금 쓰는 음성 모델의 목소리 선택지 */
export function ttsVoices(db: Database): Array<{ id: string; label: string }> {
  const m = resolveModel(db, "tts");
  const kind = m ? (db.ai_providers ?? []).find((p) => p.id === m.provider_id)?.kind : undefined;
  return kind ? VOICES[kind] : [];
}

// --- 작업 명세 만들기 ---------------------------------------------------------

export type ShortsAction = "script" | "images" | "tts" | "videos" | "music" | "compose";

export interface JobSpec {
  kind: AiJobKind;
  capability: AiCapability | null;
  shotId: string | null;
  input: AiInput & Record<string, unknown>;
  label: string;
}

function shotLabel(project: ShortsProject, shotId: string) {
  const i = project.shots.findIndex((s) => s.id === shotId);
  return `${i + 1}번 컷`;
}

/** 크리에이터 요청 → 작업 목록 (shotIds 가 없으면 아직 결과가 없는 컷 전체) */
export function buildSpecs(project: ShortsProject, action: ShortsAction, shotIds?: string[], extra?: string): JobSpec[] {
  const pick = (has: (s: ShortsShot) => boolean) =>
    shotIds?.length ? project.shots.filter((s) => shotIds.includes(s.id)) : project.shots.filter((s) => !has(s));
  switch (action) {
    case "script": {
      if (!project.topic.trim()) throw new AiError("주제를 먼저 입력해 주세요.");
      return [{ kind: "script", capability: "text", shotId: null, input: scriptPrompt({ topic: project.topic, template: project.template, tone: project.tone, target_seconds: project.target_seconds, extra }), label: "대본 작성" }];
    }
    case "images":
      return pick((s) => !!s.image_file_id).map((s) => {
        if (!s.visual.trim()) throw new AiError(`${shotLabel(project, s.id)}의 장면 묘사가 비어 있습니다.`);
        return { kind: "shot_image" as const, capability: "image" as const, shotId: s.id, input: { prompt: imagePrompt(s.visual), aspect: "9:16" }, label: `${shotLabel(project, s.id)} 이미지` };
      });
    case "tts":
      return pick((s) => !!s.audio_file_id)
        .filter((s) => s.narration.trim())
        .map((s) => ({ kind: "shot_tts" as const, capability: "tts" as const, shotId: s.id, input: { text: s.narration.trim(), voice: project.voice || undefined }, label: `${shotLabel(project, s.id)} 음성` }));
    case "videos":
      // 컷을 지정하지 않으면 "이미지는 있고 영상은 없는 컷"만 대상으로 한다
      return (shotIds?.length ? project.shots.filter((s) => shotIds.includes(s.id)) : project.shots.filter((s) => s.image_file_id && !s.video_file_id)).map((s) => {
        if (!s.image_file_id) throw new AiError(`${shotLabel(project, s.id)}은(는) 컷 이미지를 먼저 만들어야 영상으로 만들 수 있습니다.`);
        return {
          kind: "shot_video" as const,
          capability: "video" as const,
          shotId: s.id,
          input: { prompt: videoPrompt(s.visual, s.camera_move), seconds: Math.max(2, Math.min(10, s.seconds)), aspect: "9:16", image_file_id: s.image_file_id },
          label: `${shotLabel(project, s.id)} 영상 클립`,
        };
      });
    case "music": {
      const total = project.shots.reduce((a, s) => a + (s.audio_seconds ? Math.max(s.seconds, s.audio_seconds + 0.3) : s.seconds), 0) || project.target_seconds;
      const prompt = (project.bgm_prompt || "upbeat light background music for a short video, instrumental, no vocals").trim();
      return [{ kind: "music", capability: "music", shotId: null, input: { prompt, seconds: Math.ceil(total) }, label: "배경음악" }];
    }
    case "compose":
      return [{ kind: "compose", capability: null, shotId: null, input: {}, label: "합성" }];
  }
}

/**
 * 합성 결과에 영향을 주는 값의 요약. 합성할 때 저장해 두고 지금 값과 다르면 "다시 합성 필요"를 보여 준다.
 * (내레이션·자막·컷 순서·길이·카메라·영상 사용 여부·이미지/음성/영상 파일·배경음악·자막 위치)
 */
export function composeSignature(project: ShortsProject): string {
  return JSON.stringify([
    project.shots.map((s) => [s.id, s.caption, s.narration, s.camera_move, s.seconds, !!(s.use_video && s.video_file_id), s.image_file_id, s.audio_file_id, s.use_video ? s.video_file_id : null]),
    project.bgm_file_id,
    project.bgm_volume,
    project.subtitle_position,
  ]);
}

// --- 견적 · 등록 ---------------------------------------------------------------

export interface EstimateLine {
  label: string;
  capability: AiCapability | null;
  model: string | null;
  units: number;
  funny: number;
}

export function estimateSpecs(db: Database, specs: JobSpec[]): { lines: EstimateLine[]; total: number } {
  const settings = getAiShortsSettings(db);
  const lines: EstimateLine[] = specs.map((spec) => {
    if (!spec.capability) return { label: spec.label, capability: null, model: null, units: 0, funny: 0 };
    const model = resolveModel(db, spec.capability);
    if (!model) throw new AiError(`${CAPABILITY_LABELS[spec.capability]}에 사용할 AI가 아직 준비되지 않았습니다. 관리자에게 문의하세요.`, 503, "model_unavailable");
    const units = unitsFor(spec.capability, spec.input, model, providerKindOf(db, model));
    return { label: spec.label, capability: spec.capability, model: model.label, units, funny: funnyFor(model, settings, units) };
  });
  return { lines, total: lines.reduce((a, l) => a + l.funny, 0) };
}

/**
 * 이번 달 AI 원가 = 공급사에 실제로 보낸 요청의 누적 원가(실패·취소·재시도 포함, vendor_cost_won)
 *                 + 진행 중 작업 중 아직 공급사에 접수되지 않은 작업의 예상 원가.
 * (크리에이터에게는 실패·취소 시 퍼니를 전액 돌려주지만, 공급사 비용은 이미 나갔으므로 예산에는 남긴다)
 */
export function jobBudgetCostWon(j: AiJob): number {
  if (!j.capability) return 0;
  if (j.vendor_cost_won === undefined) {
    // 이 필드가 생기기 전 작업: 예전 방식(성공·진행 중 작업의 원가)
    return j.status === "succeeded" || ACTIVE.includes(j.status) ? j.cost_won || 0 : 0;
  }
  // 이번 시도의 비용을 이미 vendor_cost_won 에 기록했으면 예상 원가를 또 더하지 않는다 (이중 집계 방지)
  const recorded = (j as CostTrackedJob).cost_recorded_attempt === j.attempts;
  const pending = ACTIVE.includes(j.status) && !j.vendor_ref && !recorded ? j.cost_won || 0 : 0;
  return (j.vendor_cost_won || 0) + pending;
}

export function monthCostWon(db: Database): number {
  const from = kstMonthStartIso();
  return (db.ai_jobs ?? []).filter((j) => j.created_at >= from).reduce((sum, j) => sum + jobBudgetCostWon(j), 0);
}

/**
 * 작업 등록 (반드시 tx 안). 실패하면 예외 → tx 전체 롤백 (일부만 예약되는 일 없음)
 * idempotencyKey: 같은 요청을 두 번 보내도(더블클릭·재전송) 한 번만 등록
 */
export function enqueueSpecs(
  db: Database,
  user: Pick<Profile, "id" | "role" | "status" | "vibe_member_at">,
  project: ShortsProject,
  specs: JobSpec[],
  opts: { idempotencyKey?: string | null; allowWhenClosed?: boolean } = {}
): AiJob[] {
  const { jobs } = aiTables(db);
  // 바이브회원만 — 스위치 OFF 합성(무료) 예외보다 먼저 확인한다 (일반회원은 합성·견적도 불가)
  if (vibeOnlyError(db, user)) throw new AiError(VIBE_ONLY_MESSAGE, 403, "not_member");
  if (opts.idempotencyKey) {
    const existing = jobs.filter((j) => j.user_id === user.id && j.idempotency_key === opts.idempotencyKey);
    if (existing.length) return existing;
  }
  const access = aiShortsAccess(db, user);
  // 스위치 OFF 여도 합성(무료)은 허용하되, 활성 크리에이터 본인 숏츠만
  if (!access.open && !(opts.allowWhenClosed && user.role === "creator" && user.status === "active" && project.user_id === user.id)) {
    throw new AiError(access.reason, 403, "closed");
  }
  if (!specs.length) throw new AiError("만들 항목이 없습니다. 이미 모두 만들어졌거나 선택한 컷이 없습니다.");
  // 음성은 길이 확인에 ffmpeg 가 필요하다 → 없는 것으로 확인된 상태면 공급사 비용이 나기 전에 막는다
  if (specs.some((s) => s.kind === "shot_tts") && ffmpegKnownMissing()) throw new AiError(FFMPEG_MISSING_TTS, 503, "ffmpeg_missing");
  const settings = getAiShortsSettings(db);

  // 대본을 다시 쓰면 컷이 통째로 바뀐다 → 대본과 컷·음악·합성 작업이 서로 겹치지 않게 한다
  const projectActive = jobs.filter((j) => j.project_id === project.id && ACTIVE.includes(j.status));
  if (specs.some((s) => s.kind === "script") && projectActive.some((j) => j.kind !== "script")) {
    throw new AiError("컷 이미지·음성·영상·음악·합성 작업이 진행 중일 때는 대본을 다시 만들 수 없습니다. 작업이 끝난 뒤 다시 시도해 주세요.", 409, "busy");
  }
  if (specs.some((s) => s.kind !== "script") && projectActive.some((j) => j.kind === "script")) {
    throw new AiError("대본을 만드는 중입니다. 대본이 완성된 뒤 다시 시도해 주세요.", 409, "busy");
  }
  // 같은 컷·같은 종류 작업이 이미 진행 중이면 중복 등록 막기
  for (const spec of specs) {
    const dup = jobs.find((j) => j.project_id === project.id && j.kind === spec.kind && j.shot_id === spec.shotId && ACTIVE.includes(j.status));
    if (dup) throw new AiError(`${spec.label} 작업이 이미 진행 중입니다.`, 409, "duplicate");
    // 컷 이미지와 영상 클립은 서로 얽혀 있다: 영상은 이미지로 만들고, 이미지를 새로 만들면 기존 영상은 지워진다
    if (spec.kind === "shot_image" && projectActive.some((j) => j.kind === "shot_video" && j.shot_id === spec.shotId)) {
      throw new AiError(`${shotLabel(project, spec.shotId!)}의 AI 영상 클립을 만드는 중이라 이미지를 다시 만들 수 없습니다. 영상 클립이 완성된 뒤 다시 시도해 주세요.`, 409, "busy");
    }
    if (spec.kind === "shot_video" && projectActive.some((j) => j.kind === "shot_image" && j.shot_id === spec.shotId)) {
      throw new AiError(`${shotLabel(project, spec.shotId!)}의 이미지를 만드는 중입니다. 이미지가 완성된 뒤 영상 클립을 만들어 주세요.`, 409, "busy");
    }
  }
  // 합성은 무료라 남용을 막기 위해 크리에이터 1명당 동시에 1개만
  if (specs.some((s) => s.kind === "compose") && jobs.some((j) => j.user_id === user.id && j.kind === "compose" && ACTIVE.includes(j.status))) {
    throw new AiError("이미 합성 중인 숏츠가 있습니다. 합성이 끝난 뒤 다시 시도해 주세요.", 409, "compose_busy");
  }
  const activeCount = jobs.filter((j) => j.user_id === user.id && ACTIVE.includes(j.status)).length;
  if (activeCount + specs.length > settings.max_active_jobs_per_user) {
    throw new AiError(`동시에 진행할 수 있는 작업은 최대 ${settings.max_active_jobs_per_user}개입니다. 진행 중인 작업이 끝난 뒤 다시 시도해 주세요.`, 429, "too_many");
  }
  for (const spec of specs) {
    const term =
      spec.kind === "compose"
        ? // 합성은 자막·제목이 영상에 그대로 새겨진다
          blockedTermInAny([project.title, project.topic, ...project.shots.flatMap((s) => [s.caption, s.narration])], settings)
        : blockedTermInAny([String(spec.input.prompt ?? ""), String(spec.input.text ?? ""), project.topic], settings);
    if (term) throw new AiError(`사용할 수 없는 표현이 포함되어 있습니다: "${term}"`, 400, "blocked_term");
  }
  const { lines, total } = estimateSpecs(db, specs);

  if (total > 0) {
    // 플랫폼 월 예산
    if (settings.monthly_budget_won > 0) {
      const estCost = specs.reduce((sum, spec) => {
        if (!spec.capability) return sum;
        const m = resolveModel(db, spec.capability)!;
        return sum + costWonFor(m, settings, unitsFor(spec.capability, spec.input, m, providerKindOf(db, m)));
      }, 0);
      if (monthCostWon(db) + estCost > settings.monthly_budget_won) {
        // 관리자 알림은 롤백되지 않도록 호출한 쪽에서 별도 tx 로 보낸다 (notifyBudgetReachedOnce)
        throw new AiError("이번 달 AI 제작 한도에 도달해 지금은 새 작업을 시작할 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.", 503, "budget");
      }
    }
    // 크리에이터 하루 한도
    if (settings.daily_limit_funny > 0) {
      const from = kstDayStartIso();
      const used = jobs
        .filter((j) => j.user_id === user.id && j.created_at >= from)
        .reduce((sum, j) => sum + (j.status === "succeeded" ? j.charged_funny : ACTIVE.includes(j.status) ? j.hold_paid + j.hold_bonus : 0), 0);
      if (used + total > settings.daily_limit_funny) {
        throw new AiError(`하루 사용 한도(${formatFunny(settings.daily_limit_funny)})를 넘습니다. 오늘 사용: ${formatFunny(used)}`, 429, "daily_limit");
      }
    }
  }

  const created: AiJob[] = [];
  specs.forEach((spec, i) => {
    const line = lines[i];
    const id = genId();
    const model = spec.capability ? resolveModel(db, spec.capability) : null;
    let holdPaid = 0;
    let holdBonus = 0;
    if (line.funny > 0) {
      const h = holdFunny(db, { userId: user.id, amount: line.funny, jobId: id, memo: `${project.title || "숏츠"} · ${spec.label}` });
      holdPaid = h.holdPaid;
      holdBonus = h.holdBonus;
    }
    const job: AiJob = {
      id,
      user_id: user.id,
      project_id: project.id,
      shot_id: spec.shotId,
      kind: spec.kind,
      capability: spec.capability,
      model_ref: model?.id ?? null,
      input: spec.input as Record<string, unknown>,
      status: "queued",
      attempts: 0,
      vendor_ref: null,
      next_poll_at: null,
      lease_until: null,
      worker_id: null,
      units: line.units,
      hold_paid: holdPaid,
      hold_bonus: holdBonus,
      charged_funny: 0,
      cost_won: model && spec.capability ? costWonFor(model, settings, line.units) : 0,
      vendor_cost_won: 0,
      progress: 0,
      error: null,
      error_detail: null,
      result_file_id: null,
      idempotency_key: opts.idempotencyKey ?? null,
      created_at: iso(),
      started_at: null,
      finished_at: null,
      updated_at: iso(),
    };
    jobs.push(job);
    created.push(job);
  });
  if (specs.some((s) => s.kind === "compose")) {
    project.status = "composing";
    project.compose_error = null;
    project.updated_at = iso();
  }
  return created;
}

/**
 * 관리자 "시험 생성"의 공급사 비용 기록 (반드시 tx 안).
 * 퍼니는 걷지 않지만 공급사 비용은 났으므로, 일반 작업과 같은 방식(ai_jobs.vendor_cost_won)으로 남겨
 * 월 예산(monthCostWon)·작업 모니터의 공급사/월별 지출에 함께 집계되게 한다.
 */
export function recordAdminTestCost(
  db: Database,
  opts: { adminId: string; model: AiModel; capability: AiCapability; input: AiInput; usage?: { input: number; output: number }; ok: boolean; error?: string }
): AiJob {
  const { jobs } = aiTables(db);
  const settings = getAiShortsSettings(db);
  const kind: AiJobKind = opts.capability === "text" ? "script" : opts.capability === "image" ? "shot_image" : opts.capability === "tts" ? "shot_tts" : opts.capability === "video" ? "shot_video" : "music";
  const units =
    opts.capability === "text" && opts.usage && opts.usage.input + opts.usage.output > 0
      ? (opts.usage.input + opts.usage.output) / 1000
      : unitsFor(opts.capability, opts.input, opts.model, providerKindOf(db, opts.model));
  const won = costWonFor(opts.model, settings, units);
  const at = iso();
  const job: AiJob = {
    id: genId(),
    user_id: opts.adminId,
    project_id: "",
    shot_id: null,
    kind,
    capability: opts.capability,
    model_ref: opts.model.id,
    input: { admin_test: true },
    status: opts.ok ? "succeeded" : "failed",
    attempts: 1,
    vendor_ref: null,
    next_poll_at: null,
    lease_until: null,
    worker_id: null,
    units,
    hold_paid: 0,
    hold_bonus: 0,
    charged_funny: 0,
    cost_won: opts.ok ? won : 0,
    vendor_cost_won: Math.round(won * 100) / 100,
    progress: 1,
    error: opts.ok ? null : "관리자 시험 생성 실패",
    error_detail: opts.ok ? "admin test generation" : `admin test generation: ${opts.error ?? ""}`.slice(0, 2000),
    result_file_id: null,
    idempotency_key: null,
    created_at: at,
    started_at: at,
    finished_at: at,
    updated_at: at,
  };
  jobs.push(job);
  return job;
}

/** 월 예산 도달 알림 — 한 달에 한 번만 (별도 tx 에서 호출) */
export function notifyBudgetReachedOnce(db: Database) {
  const settings = getAiShortsSettings(db);
  const month = kstMonthKey();
  if (settings.budget_alert_sent_month === month) return;
  db.settings.ai_shorts = { ...settings, budget_alert_sent_month: month };
  notifyAdmins(db, { title: "AI 숏츠 월 예산 도달", message: `이번 달 AI 원가가 설정한 한도(${settings.monthly_budget_won.toLocaleString()}원)에 도달해 새 작업이 자동으로 막혔습니다. 한도를 늘리거나 다음 달까지 기다려 주세요.`, link: "/admin/ai-shorts" });
}

/** 크리에이터 취소: 아직 공급사에 보내지 않은 대기 작업만 (전액 반환) */
export function cancelJob(db: Database, jobId: string, actor: Pick<Profile, "id" | "role">): AiJob {
  const job = (db.ai_jobs ?? []).find((j) => j.id === jobId);
  if (!job) throw new AiError("작업을 찾을 수 없습니다.", 404);
  const isAdmin = actor.role === "admin";
  if (!isAdmin && job.user_id !== actor.id) throw new AiError("본인 작업만 취소할 수 있습니다.", 403);
  if (!ACTIVE.includes(job.status)) throw new AiError("이미 끝난 작업입니다.", 409);
  if (!isAdmin && (job.status === "running" || job.vendor_ref)) {
    throw new AiError("이미 AI가 만들고 있는 작업은 취소할 수 없습니다. 완료되거나 실패하면 퍼니가 자동 정산됩니다.", 409);
  }
  // (진행 중이던 요청의 공급사 비용은 그 요청을 처리하던 실행기가 결과를 받을 때 기록한다)
  finishFailed(db, job, { status: "cancelled", publicError: isAdmin ? "관리자가 작업을 취소했습니다." : "작업을 취소했습니다.", detail: `cancelled by ${actor.id}` });
  audit(db, { actorId: actor.id, action: "ai_job_cancel", targetTable: "ai_jobs", targetId: job.id });
  return job;
}

// --- 정산 ---------------------------------------------------------------------

/** 공급사 측 실제 지출 누적 (크리에이터 환불과 별개로 월 예산·관리자 통계에 쓴다) */
function addVendorCost(job: AiJob, won: number, attempt?: number) {
  if (attempt !== undefined) (job as CostTrackedJob).cost_recorded_attempt = attempt;
  if (!(won > 0)) return;
  job.vendor_cost_won = Math.round(((job.vendor_cost_won ?? 0) + won) * 100) / 100;
}

/** tx 를 따로 열어 공급사 지출을 기록 (작업 상태와 상관없이 — 관리자 취소 뒤 도착한 결과도 비용은 났다) */
function recordVendorCost(jobId: string, won: number, attempt?: number) {
  if (!(won > 0) && attempt === undefined) return;
  try {
    tx((db) => {
      const j = (db.ai_jobs ?? []).find((x) => x.id === jobId);
      // attempt: 이 시도의 비용이 기록됐다는 표시 → 진행 중 예상 원가·임대 회수에서 다시 더하지 않는다
      if (j) addVendorCost(j, won, attempt);
    });
  } catch (error) {
    console.error("[ai-engine] vendor cost record failed", jobId, error);
  }
}

function finishFailed(db: Database, job: AiJob, opts: { status?: "failed" | "cancelled"; publicError: string; detail?: string }) {
  if (job.hold_paid + job.hold_bonus > 0) {
    releaseFunny(db, { userId: job.user_id, jobId: job.id, holdPaid: job.hold_paid, holdBonus: job.hold_bonus, memo: opts.status === "cancelled" ? "작업 취소 반환" : "작업 실패 반환" });
  }
  job.status = opts.status ?? "failed";
  job.error = opts.publicError;
  job.error_detail = opts.detail ?? opts.publicError;
  job.cost_won = 0;
  job.finished_at = iso();
  job.updated_at = iso();
  job.lease_until = null;
  job.worker_id = null;
  job.heartbeat_at = null;
  if (job.kind === "compose") {
    const project = (db.shorts_projects ?? []).find((p) => p.id === job.project_id);
    if (project && project.status === "composing") {
      project.status = project.output_file_id ? "composed" : "scripted";
      project.compose_error = opts.publicError;
      project.updated_at = iso();
    }
  }
}

/** 크리에이터에게 보여줄 오류 문구 (키·주소·서버 경로 제거) */
export function publicError(err: unknown): string {
  const e = err as Error & { status?: number };
  const raw = String(e?.message || "알 수 없는 오류");
  if (err instanceof VendorError) {
    if (/^AI 공급사 오류\(|^AI 공급사에 연결하지 못했습니다|^AI 공급사 응답을 읽지 못했습니다/.test(raw)) {
      if (err.status === 401) return "AI 공급사 인증에 실패했습니다. 관리자에게 문의해 주세요.";
      if (err.status === 403) return "AI 공급사가 이 요청을 거절했습니다(권한·지역·정책). 관리자에게 문의해 주세요.";
      if (err.status === 400) return "AI 공급사가 요청 내용을 처리하지 못했습니다. 장면 묘사나 문장을 바꿔 다시 시도해 주세요.";
      return "AI 공급사에서 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.";
    }
  }
  return raw
    .replace(/\b(sk|pk|rk|key|api[_-]?key)[-_][A-Za-z0-9*._-]{6,}/gi, "[비공개]")
    .replace(/Bearer\s+\S+/gi, "Bearer [비공개]")
    .replace(/https?:\/\/\S+/gi, "[주소]")
    .replace(/(?:[A-Za-z]:\\|\/)(?:[\w.@-]+[\\/]){1,}[\w.@-]*/g, "[경로]")
    .slice(0, 300);
}

// --- 실행기 (프로세스당 1개) -----------------------------------------------------

type EngineState = {
  started: boolean;
  timer: NodeJS.Timeout | null;
  inflight: Set<string>;
  workerId: string;
  ticking: boolean;
  kickTimer: NodeJS.Timeout | null;
  /** 할 일이 있을 수 있음 (등록 직후·진행 중) — 없으면 30초마다만 확인해 파일 읽기를 줄인다 */
  dirty: boolean;
  lastScan: number;
  heartbeatTimer?: NodeJS.Timeout | null;
};
const G = globalThis as unknown as { __vfAiEngine?: EngineState };
function state(): EngineState {
  if (!G.__vfAiEngine) G.__vfAiEngine = { started: false, timer: null, inflight: new Set(), workerId: randomUUID(), ticking: false, kickTimer: null, dirty: true, lastScan: 0 };
  return G.__vfAiEngine;
}

export function startAiEngine() {
  const s = state();
  if (s.started || process.env.AI_ENGINE === "off") return;
  s.started = true;
  // 재시작 직후에도 다른(이전) 프로세스의 작업을 곧바로 빼앗지 않는다 — PM2 reload·롤링 재시작 중에는 이전 프로세스가
  // 아직 공급사를 호출하고 있을 수 있다(중복 호출·거짓 "서버 점검" 환불 방지).
  // 대신 실행 중인 작업은 HEARTBEAT_MS 마다 임대를 연장(heartbeat)하고, 임대가 끝났거나 heartbeat 가
  // HEARTBEAT_STALE_MS(2분) 넘게 끊긴 작업만 tick() 에서 회수한다.
  s.timer = setInterval(() => void tick(), 1_500);
  s.timer.unref?.();
  s.heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
  s.heartbeatTimer.unref?.();
  void ffmpegAvailable(); // 음성 작업 전 확인용 캐시 미리 채우기
}

/** 이 프로세스가 실행 중인 작업의 임대 연장 (작업을 잡은 워커가 그대로일 때만) */
function heartbeat() {
  const s = state();
  if (!s.inflight.size) return;
  const ids = new Set(s.inflight);
  try {
    tx((db) => {
      const now = Date.now();
      for (const j of db.ai_jobs ?? []) {
        if (!ids.has(j.id) || j.status !== "running" || j.worker_id !== s.workerId) continue;
        // 제한 시간을 넘긴 작업은 더 연장하지 않는다 (임대가 끝나면 기한 초과로 정리됨)
        if (j.started_at && now - Date.parse(j.started_at) > DEADLINE_MS[j.kind]) continue;
        j.lease_until = new Date(now + leaseMsFor(j)).toISOString();
        j.heartbeat_at = new Date(now).toISOString();
      }
    });
  } catch (error) {
    console.error("[ai-engine] heartbeat failed", error);
  }
}

/**
 * 다른(죽은) 워커의 작업을 회수해도 되는가: 임대가 끝났거나, heartbeat 가 2분 넘게 끊겼을 때.
 * AI_ENGINE_MULTI=1(여러 서버 — 서버 간 시계가 어긋날 수 있음)이면 heartbeat 기준 조기 회수는 하지 않고 임대 만료만 본다.
 */
function reclaimable(j: AiJob, now: number, inflight: Set<string>): boolean {
  if (j.status !== "running" || inflight.has(j.id)) return false;
  if (j.lease_until && Date.parse(j.lease_until) < now) return true;
  if (process.env.AI_ENGINE_MULTI === "1") return false;
  return !!j.heartbeat_at && now - Date.parse(j.heartbeat_at) > HEARTBEAT_STALE_MS;
}

export function kickAiEngine() {
  if (process.env.AI_ENGINE === "off") return; // 이 서버에서는 AI 작업을 처리하지 않음
  const s = state();
  if (!s.started) startAiEngine();
  s.dirty = true;
  if (s.kickTimer) return;
  s.kickTimer = setTimeout(() => {
    s.kickTimer = null;
    void tick();
  }, 50);
  s.kickTimer.unref?.();
}

async function tick() {
  const s = state();
  if (s.ticking) return; // 재진입 방지
  const now = Date.now();
  if (!s.dirty && s.inflight.size === 0 && now - s.lastScan < 30_000) return;
  s.ticking = true;
  try {
    s.lastScan = now;
    const db = peekDb();
    const jobs = db.ai_jobs ?? [];
    if (!jobs.some((j) => ACTIVE.includes(j.status))) {
      s.dirty = false;
      return;
    }
    // 1) 임대가 끝난(죽은 워커의) 작업 회수
    if (jobs.some((j) => reclaimable(j, now, s.inflight))) {
      const expired = jobs.filter((j) => reclaimable(j, now, s.inflight)).map((j) => j.id);
      for (const expiredId of expired) {
       try {
       tx((d) => {
        for (const j of (d.ai_jobs ?? []).filter((x) => x.id === expiredId)) {
          if (!reclaimable(j, Date.now(), s.inflight)) continue;
          // 공급사에 요청을 보내는 중에 서버가 멈췄으면 이미 비용이 났을 수 있다 → 예산에는 예상 원가를 남긴다
          // (이 시도의 비용을 이미 기록했으면 다시 더하지 않는다)
          if (!j.vendor_ref && j.capability && (j as CostTrackedJob).cost_recorded_attempt !== j.attempts) addVendorCost(j, j.cost_won, j.attempts);
          if (j.kind === "shot_video" && !j.vendor_ref) {
            // 영상 요청을 보내는 중에 서버가 멈췄으면, 이미 접수됐을 수 있어 다시 보내지 않고 환불한다(중복 과금 방지)
            finishFailed(d, j, { publicError: "서버 점검으로 작업이 중단되어 퍼니를 돌려드렸습니다. 다시 시도해 주세요.", detail: "lease expired before vendor_ref" });
            continue;
          }
          j.status = "queued";
          j.worker_id = null;
          j.lease_until = null;
          j.heartbeat_at = null;
          j.updated_at = iso();
        }
       });
       } catch (error) {
        console.error("[ai-engine] lease recovery failed", expiredId, error);
       }
      }
    }
    // 2) 기한 초과 작업 실패 처리(전액 반환)
    const overdue = jobs.filter((j) => ACTIVE.includes(j.status) && j.started_at && now - Date.parse(j.started_at) > DEADLINE_MS[j.kind] && !s.inflight.has(j.id));
    for (const o of overdue) {
      try {
        tx((d) => {
          const j = (d.ai_jobs ?? []).find((x) => x.id === o.id);
          if (!j || !ACTIVE.includes(j.status) || (j.status === "running" && j.lease_until && Date.parse(j.lease_until) > Date.now() && !reclaimable(j, Date.now(), s.inflight))) return;
          finishFailed(d, j, { publicError: "작업 시간이 너무 오래 걸려 중단하고 퍼니를 돌려드렸습니다.", detail: "deadline exceeded" });
          notifyUser(d, { recipientId: j.user_id, title: "AI 숏츠 작업 시간 초과", message: "작업이 제한 시간을 넘어 중단되었고 예약한 퍼니를 모두 돌려드렸습니다.", link: `/creator/ai-shorts/${j.project_id}` });
        });
      } catch (error) {
        console.error("[ai-engine] deadline handling failed", o.id, error);
      }
    }
    // 3) 새로 처리할 작업 고르기
    const settings = getAiShortsSettings(db);
    const aiCap = Math.max(1, Math.min(10, settings.concurrency || 3));
    const aiInflight = [...s.inflight].filter((id) => jobs.find((j) => j.id === id)?.kind !== "compose").length;
    const composeInflight = s.inflight.size - aiInflight;
    const ready = jobs
      .filter((j) => j.status === "queued" && !s.inflight.has(j.id) && (!j.next_poll_at || Date.parse(j.next_poll_at) <= now))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    let aiSlots = aiCap - aiInflight;
    let composeSlots = 1 - composeInflight;
    for (const j of ready) {
      if (j.kind === "compose") {
        if (composeSlots <= 0) continue;
        composeSlots--;
      } else {
        // 공급사가 연속 실패로 사용 중지 중이면 호출하지 않고 미룬다 (슬롯도 쓰지 않음)
        // (이미 공급사에 접수된 작업(vendor_ref)의 결과 확인은 비용이 이미 났으므로 미루지 않는다)
        if (!j.vendor_ref && providerCooldownUntil(db, j.model_ref) !== null) {
          deferForCooldown(j.id);
          continue;
        }
        if (aiSlots <= 0) continue;
        aiSlots--;
      }
      const claimed = claim(j.id);
      if (claimed) {
        s.inflight.add(claimed.id);
        void execute(claimed)
          .catch((error) => console.error("[ai-engine] job execution error", claimed.id, error))
          .finally(() => s.inflight.delete(claimed.id));
      }
    }
  } catch (error) {
    console.error("[ai-engine] tick error", error);
  } finally {
    s.ticking = false;
  }
}

/** 차단기(cooldown) 중인 공급사의 대기 작업: 해제 시각(최대 1분 뒤)까지 미룬다 */
function deferUntil(db: Database, j: AiJob): boolean {
  const until = j.kind === "compose" || j.vendor_ref ? null : providerCooldownUntil(db, j.model_ref);
  if (until === null) return false;
  j.next_poll_at = new Date(Math.min(until, Date.now() + COOLDOWN_RECHECK_MS)).toISOString();
  j.updated_at = iso();
  return true;
}

function deferForCooldown(jobId: string) {
  try {
    tx((db) => {
      const j = (db.ai_jobs ?? []).find((x) => x.id === jobId);
      if (j && j.status === "queued") deferUntil(db, j);
    });
  } catch (error) {
    console.error("[ai-engine] cooldown defer failed", jobId, error);
  }
}

function claim(jobId: string): AiJob | null {
  const s = state();
  return tx((db) => {
    const j = (db.ai_jobs ?? []).find((x) => x.id === jobId);
    if (!j || j.status !== "queued") return null;
    if (j.next_poll_at && Date.parse(j.next_poll_at) > Date.now()) return null;
    if (deferUntil(db, j)) return null; // 공급사 사용 중지 중 → 호출하지 않음
    j.status = "running";
    j.worker_id = s.workerId;
    j.lease_until = new Date(Date.now() + leaseMsFor(j)).toISOString();
    j.heartbeat_at = iso();
    if (!j.started_at) j.started_at = iso();
    if (!j.vendor_ref) j.attempts += 1;
    j.updated_at = iso();
    return { ...j };
  });
}

/** 이 워커가 잡은 상태 그대로인지 확인하고 tx 안에서 변경 (관리자 강제 취소 등으로 바뀌었으면 무시) */
function withOwnedJob<T>(job: AiJob, fn: (db: Database, j: AiJob) => T): T | null {
  const s = state();
  return tx((db) => {
    const j = (db.ai_jobs ?? []).find((x) => x.id === job.id);
    if (!j || j.status !== "running" || j.worker_id !== s.workerId) return null;
    return fn(db, j);
  });
}

async function fileBuffer(db: Database, fileId: string | null | undefined): Promise<{ buffer: Buffer; mime: string; ext: string } | null> {
  if (!fileId) return null;
  const f = (db.private_files ?? []).find((x) => x.id === fileId);
  if (!f) return null;
  const buffer = await storage.get(f.storage_name);
  return { buffer, mime: f.mime_type, ext: f.storage_name.split(".").pop() || "bin" };
}

async function saveResultFile(userId: string, buffer: Buffer, mime: string, ext: string, name: string) {
  const id = genId();
  const storageName = `${id}.${ext}`;
  await storage.save(storageName, buffer, mime);
  return { id, storage_name: storageName, original_name: name, mime_type: mime, size: buffer.length, owner_id: userId };
}

async function execute(job: AiJob) {
  if (job.kind === "compose") return executeCompose(job);
  const db = getDb();
  const model = (db.ai_models ?? []).find((m) => m.id === job.model_ref);
  const provider = model ? (db.ai_providers ?? []).find((p) => p.id === model.provider_id) : undefined;
  const adapter = provider ? adapterFor(provider.kind) : null;
  if (!model || !provider || !adapter || !job.capability) {
    withOwnedJob(job, (d, j) => finishFailed(d, j, { publicError: "이 작업에 쓸 AI 모델을 찾을 수 없어 퍼니를 돌려드렸습니다.", detail: "model/provider missing" }));
    return;
  }
  const key = provider.kind === "mock" ? "" : decryptSensitive(provider.api_key_enc);
  const settings = getAiShortsSettings(db);
  // 이미 공급사에 접수된 작업(vendor_ref)은 결과만 확인한다 — 원본 이미지 등 입력 파일을 다시 읽지 않는다
  const submitting = !(job.vendor_ref && adapter.poll);
  let sent = false;
  let costRecorded = false;
  try {
    let outcome: RunOutcome;
    if (!submitting) {
      outcome = await adapter.poll!({ provider, model, capability: job.capability, ref: job.vendor_ref!, key });
    } else {
      const input: AiInput = { ...(job.input as AiInput) };
      // 관리자가 음성 공급사를 바꾼 경우: 이전 공급사의 목소리 값이면 현재 공급사 기본 목소리로 바꾼다
      if (job.capability === "tts") {
        const voices = VOICES[provider.kind] ?? [];
        if (voices.length && !voices.some((v) => v.id === input.voice)) input.voice = voices[0].id || undefined;
      }
      // 과금한 길이(job.units)와 실제 요청 길이를 맞춘다
      if (job.capability === "music") input.seconds = Math.max(1, Math.round(job.units || musicSeconds(input, model)));
      if (job.capability === "video" && job.units > 0) input.seconds = job.units;
      // 음성은 결과 길이 확인에 ffmpeg 가 필요하다 → 없으면 공급사를 부르지 않고 바로 실패(전액 반환)
      if (job.kind === "shot_tts" && !(await ffmpegAvailable())) {
        withOwnedJob(job, (d, j) => {
          finishFailed(d, j, { publicError: `${FFMPEG_MISSING_TTS} (예약한 퍼니는 모두 돌려드렸습니다)`, detail: "ffmpeg unavailable before tts submit" });
          notifyUser(d, { recipientId: j.user_id, title: "AI 숏츠 작업 실패", message: "음성 작업을 처리할 수 없어 예약한 퍼니를 돌려드렸습니다.", link: `/creator/ai-shorts/${j.project_id}` });
        });
        return;
      }
      if (job.kind === "shot_video") {
        const img = await fileBuffer(db, String(job.input.image_file_id || ""));
        if (!img) throw new AiError("영상으로 만들 컷 이미지를 찾을 수 없습니다. 컷 이미지를 다시 만든 뒤 시도해 주세요.", 400);
        input.image = { buffer: img.buffer, mime: img.mime };
      }
      sent = true;
      outcome = await adapter.run({ provider, model, capability: job.capability, input, key });
      // 공급사가 요청을 받아들였다 → 이 시도의 비용은 이미 났다
      const usage = outcome.status === "done" ? outcome.result.usage : undefined;
      const units = job.capability === "text" && usage && usage.input + usage.output > 0 ? (usage.input + usage.output) / 1000 : job.units;
      recordVendorCost(job.id, costWonFor(model, settings, units), job.attempts);
      costRecorded = true;
    }
    if (outcome.status === "pending") {
      withOwnedJob(job, (_d, j) => {
        j.vendor_ref = outcome.ref;
        j.status = "queued";
        j.worker_id = null;
        j.lease_until = null;
        j.heartbeat_at = null;
        j.next_poll_at = new Date(Date.now() + (POLL_MS[job.capability!] ?? 3_000)).toISOString();
        j.updated_at = iso();
      });
      return;
    }
    await settleSuccess(job, model, provider, outcome.result);
  } catch (error) {
    // 요청을 보냈는데 오류: HTTP 오류 응답·연결 실패(billed=false)가 아니면 공급사 비용이 났다고 본다
    if (sent && !costRecorded && !(error instanceof VendorError && error.billed === false)) recordVendorCost(job.id, job.cost_won, job.attempts);
    handleFailure(job, model, provider, error);
  }
}

function markProviderHealthy(db: Database, providerId: string) {
  const p = (db.ai_providers ?? []).find((x) => x.id === providerId);
  if (p && (p.fail_streak || p.cooldown_until)) {
    p.fail_streak = 0;
    p.cooldown_until = null;
    p.updated_at = iso();
  }
}

async function settleSuccess(job: AiJob, model: AiModel, provider: AiProvider, result: AiResult) {
  const settings = getAiShortsSettings(getDb());
  // 대본: 형식 검증 (깨졌으면 한 번 더 시도)
  if (job.kind === "script") {
    const project = (getDb().shorts_projects ?? []).find((p) => p.id === job.project_id);
    const parsed = parseScript(String(result.text || ""), project?.target_seconds ?? 30);
    const used = result.usage && result.usage.input + result.usage.output > 0 ? (result.usage.input + result.usage.output) / 1000 : job.units;
    // AI 가 만든 대본에도 금칙어 검사 → 걸리면 적용하지 않고 실패 처리(퍼니 전액 반환)
    const term = blockedTermInAny(
      [parsed.title, parsed.hook, parsed.description, parsed.bgm_prompt, ...parsed.hashtags, ...parsed.shots.flatMap((s) => [s.narration, s.caption, s.visual])],
      settings
    );
    if (term) {
      withOwnedJob(job, (db, j) => {
        markProviderHealthy(db, provider.id);
        finishFailed(db, j, {
          publicError: `AI가 만든 대본에 사용할 수 없는 표현("${term}")이 들어 있어 대본을 적용하지 않았습니다. 주제나 추가 요청을 바꿔 다시 시도해 주세요. (예약한 퍼니는 모두 돌려드렸습니다)`,
          detail: `blocked term in script result: ${term}`,
        });
        notifyUser(db, { recipientId: j.user_id, title: "AI 숏츠 대본 적용 안 됨", message: "AI가 만든 대본에 사용할 수 없는 표현이 있어 적용하지 않고 예약한 퍼니를 돌려드렸습니다.", link: `/creator/ai-shorts/${j.project_id}` });
      });
      return;
    }
    withOwnedJob(job, (db, j) => {
      const charge = Math.min(j.hold_paid + j.hold_bonus, funnyFor(model, settings, used));
      const cap = captureFunny(db, { userId: j.user_id, jobId: j.id, holdPaid: j.hold_paid, holdBonus: j.hold_bonus, charge, memo: "대본 작성" });
      j.status = "succeeded";
      j.charged_funny = cap.used;
      j.units = used;
      j.cost_won = costWonFor(model, settings, used);
      j.finished_at = iso();
      j.updated_at = iso();
      j.lease_until = null;
      markProviderHealthy(db, provider.id);
      const p = (db.shorts_projects ?? []).find((x) => x.id === j.project_id);
      if (p) {
        const replacedFiles = p.shots.flatMap((s) => [s.image_file_id, s.audio_file_id, s.video_file_id]).filter(Boolean) as string[];
        p.title = p.title?.trim() ? p.title : parsed.title || p.topic.slice(0, 40);
        p.hook = parsed.hook;
        p.description = parsed.description;
        p.hashtags = parsed.hashtags;
        p.bgm_prompt = parsed.bgm_prompt || p.bgm_prompt;
        p.shots = parsed.shots.map((s) => ({ id: genId(), ...s, use_video: false, image_file_id: null, audio_file_id: null, audio_seconds: null, audio_text: null, video_file_id: null }));
        p.status = "scripted";
        p.output_file_id = null;
        p.updated_at = iso();
        // 이전 컷 결과물은 더 이상 쓰지 않으므로 정리 대상
        markFilesForCleanup(db, replacedFiles);
      }
    });
    return;
  }

  // 미디어: 파일 받기 → 형식 확인 → 저장
  const buffer = result.data ?? (result.url ? await download(result.url, result.headers ?? {}) : null);
  if (!buffer || !buffer.length) throw new VendorError("AI 결과 파일이 비어 있습니다.", { contentIssue: true });
  const sniff = sniffMime(buffer);
  const expected: Record<string, RegExp> = { shot_image: /^image\//, shot_tts: /^audio\//, music: /^audio\//, shot_video: /^video\// };
  if (!sniff || !expected[job.kind].test(sniff.mime)) throw new VendorError("AI 결과 파일 형식이 올바르지 않습니다.", { retryable: true });
  let audioSeconds: number | null = null;
  if (job.kind === "shot_tts") {
    const tmp = path.join(tmpdir(), `vf-tts-${randomUUID()}.${sniff.ext}`);
    await writeFile(tmp, buffer);
    try {
      audioSeconds = Math.round((await probeMedia(tmp)).duration * 100) / 100;
    } catch (error) {
      // 공급사 비용은 이미 났다 → 길이 확인 실패로 결과를 버리지 않고 추정 길이로 저장한다
      console.error("[ai-engine] tts probe failed, using estimated duration", job.id, error);
      audioSeconds = estimateAudioSeconds(buffer, sniff.mime, String(job.input.text ?? ""));
    } finally {
      await rm(tmp, { force: true }).catch(() => {});
    }
  }
  const saved = await saveResultFile(job.user_id, buffer, sniff.mime, sniff.ext, `${job.kind}-${job.id}.${sniff.ext}`);
  let committed: boolean | null = null;
  try {
  committed = withOwnedJob(job, (db, j) => {
    // 실제 사용량: 음성은 글자 수, 나머지는 예상과 같음 → 예약보다 더 걷지 않는다
    const charge = Math.min(j.hold_paid + j.hold_bonus, funnyFor(model, settings, j.units));
    const cap = captureFunny(db, { userId: j.user_id, jobId: j.id, holdPaid: j.hold_paid, holdBonus: j.hold_bonus, charge, memo: CAPABILITY_LABELS[j.capability!] });
    if (!db.private_files) db.private_files = [];
    db.private_files.push({ ...saved, source: "ai_shorts", created_at: iso() });
    j.status = "succeeded";
    j.charged_funny = cap.used;
    j.cost_won = costWonFor(model, settings, j.units);
    j.result_file_id = saved.id;
    j.finished_at = iso();
    j.updated_at = iso();
    j.lease_until = null;
    markProviderHealthy(db, provider.id);
    const p = (db.shorts_projects ?? []).find((x) => x.id === j.project_id);
    if (p) {
      const old: string[] = [];
      if (j.kind === "music") {
        if (p.bgm_file_id) old.push(p.bgm_file_id);
        p.bgm_file_id = saved.id;
      } else {
        const shot = p.shots.find((s) => s.id === j.shot_id);
        if (shot) {
          if (j.kind === "shot_image") {
            if (shot.image_file_id) old.push(shot.image_file_id);
            shot.image_file_id = saved.id;
            // 이미지를 새로 만들면 그 이미지로 만든 영상은 더 이상 맞지 않는다
            if (shot.video_file_id) old.push(shot.video_file_id);
            shot.video_file_id = null;
            shot.use_video = false;
          } else if (j.kind === "shot_tts") {
            if (shot.audio_file_id) old.push(shot.audio_file_id);
            shot.audio_file_id = saved.id;
            shot.audio_seconds = audioSeconds;
            shot.audio_text = String(j.input.text ?? "");
          } else if (j.kind === "shot_video") {
            if (shot.video_file_id) old.push(shot.video_file_id);
            shot.video_file_id = saved.id;
            shot.use_video = true;
          }
        } else {
          // 대본을 다시 써서 컷이 사라진 경우: 결과물은 쓰이지 않는다
          old.push(saved.id);
        }
      }
      p.output_file_id = p.output_file_id; // 기존 완성본은 그대로 두고, 다시 합성하면 교체
      p.updated_at = iso();
      markFilesForCleanup(db, old);
    } else {
      markFilesForCleanup(db, [saved.id]);
    }
    return true;
  });
  } catch (error) {
    // 결과 저장(DB 기록)에 실패하면 저장소에만 남은 파일을 지우고 실패 처리 흐름으로 넘긴다
    await storage.delete(saved.storage_name).catch(() => {});
    throw error;
  }
  if (!committed) {
    // 관리자 취소 등으로 이미 정산된 작업 → 저장한 파일만 지운다
    await storage.delete(saved.storage_name).catch(() => {});
  }
  await flushCleanup();
}

/** ffmpeg 로 길이를 못 읽었을 때의 추정 길이(초): WAV 는 헤더로 계산, MP3 는 128kbps 기준, 그 밖에는 글자 수 기준 */
function estimateAudioSeconds(buffer: Buffer, mime: string, text: string): number {
  if (mime === "audio/wav" && buffer.length > 44) {
    const byteRate = buffer.readUInt32LE(28);
    if (byteRate > 0) return Math.round(((buffer.length - 44) / byteRate) * 100) / 100;
  }
  if (mime === "audio/mpeg") return Math.max(0.5, Math.round(((buffer.length * 8) / 128_000) * 100) / 100);
  return Math.max(1, Math.round((text.replace(/\s+/g, "").length / 7) * 100) / 100);
}

function handleFailure(job: AiJob, model: AiModel, provider: AiProvider, error: unknown) {
  const err = error as VendorError & { status?: number; detail?: string };
  const isVendor = error instanceof VendorError;
  const detail = `${err?.message || String(error)}${err?.detail ? "\n" + err.detail : ""}`.slice(0, 2000);
  try {
    recordFailure(job, provider, error, err, isVendor, detail);
  } catch (fatal) {
    // 정산 자체가 실패(데이터 불일치 등): 임대가 끝나면 다시 처리되며, 관리자가 작업 모니터에서 확인
    console.error("[ai-engine] failure handling error", job.id, fatal);
  }
  void model;
}

function recordFailure(job: AiJob, provider: AiProvider, error: unknown, err: VendorError & { status?: number }, isVendor: boolean, detail: string) {
  withOwnedJob(job, (db, j) => {
    // 결과 확인(poll) 중 일시 오류: 작업을 버리지 않고 나중에 다시 확인
    if (j.vendor_ref && isVendor && err.transient) {
      j.status = "queued";
      j.worker_id = null;
      j.lease_until = null;
      j.next_poll_at = new Date(Date.now() + 15_000).toISOString();
      j.error_detail = detail;
      j.updated_at = iso();
      return;
    }
    // 공급사 장애 집계 → 연속 실패 시 잠시 사용 중지 + 관리자 알림
    // 빈 응답·안전 정책 차단 같은 내용 문제는 공급사 장애가 아니다 → 집계하지 않는다
    const vendorFault = isVendor && !err.contentIssue && (err.status === 401 || err.status === 403 || err.retryable !== false);
    if (vendorFault) {
      const p = (db.ai_providers ?? []).find((x) => x.id === provider.id);
      if (p) {
        p.fail_streak = (p.fail_streak || 0) + 1;
        // 이미 사용 중지 중이면 기간을 늘리지 않고 알림도 다시 보내지 않는다 (사용 중지에 "들어갈 때"만 알림)
        const cooling = !!p.cooldown_until && Date.parse(p.cooldown_until) > Date.now();
        if (!cooling && (p.fail_streak >= BREAKER_FAILURES || err.status === 401)) {
          p.cooldown_until = new Date(Date.now() + BREAKER_COOLDOWN_MS).toISOString();
          notifyAdmins(db, { title: "AI 공급사 연속 실패", message: `${p.name} 호출이 연속으로 실패해 10분간 사용을 멈췄습니다. API 키·잔액·공급사 상태를 확인하세요.`, link: "/admin/ai-shorts/providers" });
        }
        p.updated_at = iso();
      }
    }
    const scriptRetry = error instanceof ScriptParseError && j.attempts < 2;
    // 영상은 요청 접수 여부를 모를 때(시간 초과) 다시 보내지 않는다 → 중복 과금 방지
    const unsafeResend = j.kind === "shot_video" && !j.vendor_ref && isVendor && err.unknownDelivery;
    const retry = scriptRetry || (isVendor && !err.contentIssue && err.retryable !== false && !unsafeResend && j.attempts < MAX_ATTEMPTS && !(j.vendor_ref && !err.transient));
    if (retry) {
      j.status = "queued";
      j.worker_id = null;
      j.lease_until = null;
      // 실패한 결과 확인 대상은 버리고 처음부터 다시 만든다
      if (!err.transient) j.vendor_ref = null;
      j.next_poll_at = new Date(Date.now() + 5_000 * j.attempts).toISOString();
      j.error_detail = detail;
      j.updated_at = iso();
      return;
    }
    const message = error instanceof ScriptParseError ? "AI가 대본 형식을 지키지 못했습니다. 다시 시도해 주세요." : error instanceof MediaError ? error.message : publicError(error);
    finishFailed(db, j, { publicError: `${message} (예약한 퍼니는 모두 돌려드렸습니다)`, detail });
    notifyUser(db, { recipientId: j.user_id, title: "AI 숏츠 작업 실패", message: `${CAPABILITY_LABELS[j.capability!] ?? "작업"}에 실패해 예약한 퍼니를 돌려드렸습니다.`, link: `/creator/ai-shorts/${j.project_id}` });
  });
}

async function executeCompose(job: AiJob) {
  const db = getDb();
  const project = (db.shorts_projects ?? []).find((p) => p.id === job.project_id);
  try {
    if (!project) throw new AiError("숏츠를 찾을 수 없습니다.", 404);
    const signature = composeSignature(project);
    const shots: ComposeShot[] = [];
    for (const s of project.shots) {
      const useVideo = s.use_video && s.video_file_id;
      const video = useVideo ? await fileBuffer(db, s.video_file_id) : null;
      const image = !video ? await fileBuffer(db, s.image_file_id) : null;
      const audio = await fileBuffer(db, s.audio_file_id);
      shots.push({
        seconds: s.seconds,
        caption: s.caption,
        narration: s.narration,
        camera_move: s.camera_move,
        video: video?.buffer ?? null,
        image: image?.buffer ?? null,
        imageExt: image?.ext,
        audio: audio?.buffer ?? null,
        audioExt: audio?.ext,
      });
    }
    const bgm = project.bgm_file_id ? await fileBuffer(db, project.bgm_file_id) : null;
    let lastReport = 0;
    const out = await composeShorts({
      shots,
      bgm: bgm?.buffer ?? null,
      bgmVolume: project.bgm_volume,
      subtitlePosition: project.subtitle_position,
      onProgress: (p) => {
        if (Date.now() - lastReport < 2_000) return;
        lastReport = Date.now();
        try {
          withOwnedJob(job, (_d, j) => {
            j.progress = Math.round(p * 100) / 100;
            j.updated_at = iso();
          });
        } catch {
          /* 진행률 기록 실패는 무시 */
        }
      },
    });
    const saved = await saveResultFile(job.user_id, out.buffer, "video/mp4", "mp4", `${(project.title || "shorts").replace(/[\\/:*?"<>|]/g, "").slice(0, 40) || "shorts"}.mp4`);
    const committed = withOwnedJob(job, (d, j) => {
      if (!d.private_files) d.private_files = [];
      d.private_files.push({ ...saved, source: "ai_shorts", created_at: iso() });
      j.status = "succeeded";
      j.progress = 1;
      j.result_file_id = saved.id;
      j.input = { ...j.input, signature };
      j.finished_at = iso();
      j.updated_at = iso();
      j.lease_until = null;
      const p = (d.shorts_projects ?? []).find((x) => x.id === j.project_id);
      if (p) {
        if (p.output_file_id) markFilesForCleanup(d, [p.output_file_id]);
        p.output_file_id = saved.id;
        p.output_seconds = out.seconds;
        p.status = "composed";
        p.compose_error = null;
        p.updated_at = iso();
      }
      notifyUser(d, { recipientId: j.user_id, title: "AI 숏츠 완성", message: `"${project.title || "숏츠"}" 합성이 끝났습니다. 미리보기와 다운로드를 확인하세요.`, link: `/creator/ai-shorts/${j.project_id}` });
      return true;
    });
    if (!committed) await storage.delete(saved.storage_name).catch(() => {});
    await flushCleanup();
  } catch (error) {
    const err = error as Error & { detail?: string };
    withOwnedJob(job, (d, j) => {
      finishFailed(d, j, { publicError: error instanceof MediaError || error instanceof AiError ? err.message : "합성에 실패했습니다. 잠시 후 다시 시도해 주세요.", detail: `${err.message}\n${err.detail ?? ""}`.slice(0, 2000) });
    });
  }
}

// --- 쓰지 않게 된 결과 파일 정리 ---------------------------------------------------

const pendingCleanup: string[] = [];

/** tx 안: 파일 기록을 지우고 실제 파일 삭제는 tx 밖(flushCleanup)에서 */
export function markFilesForCleanup(db: Database, fileIds: string[]) {
  if (!fileIds.length || !db.private_files) return;
  const ids = new Set(fileIds);
  // 다른 곳(완성본·다른 컷)에서 아직 쓰는 파일은 지우지 않는다
  for (const p of db.shorts_projects ?? []) {
    for (const s of p.shots) for (const f of [s.image_file_id, s.audio_file_id, s.video_file_id]) if (f) ids.delete(f);
    if (p.bgm_file_id) ids.delete(p.bgm_file_id);
    if (p.output_file_id) ids.delete(p.output_file_id);
  }
  // 대기·진행 중 작업이 입력으로 쓰는 파일(영상 클립의 원본 컷 이미지)도 지우지 않는다
  for (const j of db.ai_jobs ?? []) {
    if (!ACTIVE.includes(j.status)) continue;
    const input = j.input?.image_file_id;
    if (typeof input === "string" && input) ids.delete(input);
  }
  db.private_files = db.private_files.filter((f) => {
    if (ids.has(f.id) && f.source === "ai_shorts") {
      pendingCleanup.push(f.storage_name);
      return false;
    }
    return true;
  });
}

export async function flushCleanup() {
  if (!pendingCleanup.length) return;
  // tx 저장이 실패했을 수도 있으므로, DB 에서 파일 기록이 실제로 사라진 것만 지운다
  const names = pendingCleanup.splice(0, pendingCleanup.length);
  let live: Set<string>;
  try {
    live = new Set((peekDb().private_files ?? []).map((f) => f.storage_name));
  } catch {
    return;
  }
  for (const name of names) {
    if (live.has(name)) continue;
    await storage.delete(name).catch(() => {});
  }
}

// 작업 폴더 준비 (임시 파일)
export async function ensureTmp() {
  await mkdir(path.join(tmpdir(), "vibefunny-compose"), { recursive: true });
}

export { FunnyError };
