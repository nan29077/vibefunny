import { randomUUID } from "crypto";
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
import { ADAPTERS, VOICES, mockAllowed, type Adapter, type AiInput, type AiResult } from "./providers";
import { mockAdapter } from "./mock";
import { download, VendorError } from "./http";
import { costWonFor, funnyFor, unitsFor } from "./pricing";
import { aiShortsAccess, blockedTermIn, CAPABILITY_LABELS, getAiShortsSettings, kstDayStartIso, kstMonthKey, kstMonthStartIso } from "./settings";
import { imagePrompt, parseScript, scriptPrompt, ScriptParseError, videoPrompt } from "./prompts";
import { MediaError, probeMedia, sniffMime } from "./media";
import { composeShorts, type ComposeShot } from "./compose";

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

export function aiTables(db: Database) {
  if (!db.ai_providers) db.ai_providers = [];
  if (!db.ai_models) db.ai_models = [];
  if (!db.ai_jobs) db.ai_jobs = [];
  if (!db.shorts_projects) db.shorts_projects = [];
  return { providers: db.ai_providers, models: db.ai_models, jobs: db.ai_jobs, projects: db.shorts_projects };
}

export function adapterFor(kind: AiProvider["kind"]): Adapter | null {
  if (kind === "mock") return mockAllowed() ? mockAdapter : null;
  return ADAPTERS[kind] ?? null;
}

/** 지금 실제로 쓸 수 있는 모델인가 (모델·공급사 켜짐 + 키 등록 + 장애 차단 아님) */
export function modelUsable(db: Database, model: AiModel): { ok: boolean; reason: string } {
  if (!model.active) return { ok: false, reason: "모델이 꺼져 있습니다." };
  const provider = (db.ai_providers ?? []).find((p) => p.id === model.provider_id);
  if (!provider) return { ok: false, reason: "공급사가 없습니다." };
  if (!provider.active) return { ok: false, reason: "공급사가 꺼져 있습니다." };
  if (!adapterFor(provider.kind)) return { ok: false, reason: "이 환경에서 쓸 수 없는 공급사입니다." };
  if (provider.kind !== "mock" && !provider.api_key_enc) return { ok: false, reason: "API 키가 등록되지 않았습니다." };
  if (provider.cooldown_until && Date.parse(provider.cooldown_until) > Date.now()) return { ok: false, reason: "연속 실패로 잠시 사용 중지 중입니다." };
  return { ok: true, reason: "" };
}

/** 작업별로 쓸 모델: 관리자가 고른 기본 모델 → 없거나 못 쓰면 같은 종류의 사용 가능한 첫 모델 */
export function resolveModel(db: Database, capability: AiCapability): AiModel | null {
  const settings = getAiShortsSettings(db);
  const models = (db.ai_models ?? []).filter((m) => m.capability === capability);
  const chosen = models.find((m) => m.id === settings.default_models[capability]);
  if (chosen && modelUsable(db, chosen).ok) return chosen;
  return models.find((m) => modelUsable(db, m).ok) ?? null;
}

/** 크리에이터 화면: 작업별 사용 가능 여부 */
export function capabilityStatus(db: Database) {
  const out = {} as Record<AiCapability, { ready: boolean; model: string | null; maxSeconds: number | null }>;
  for (const cap of ["text", "image", "tts", "video", "music"] as AiCapability[]) {
    const m = resolveModel(db, cap);
    out[cap] = { ready: !!m, model: m?.label ?? null, maxSeconds: m?.max_seconds ?? null };
  }
  return out;
}

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
    const units = unitsFor(spec.capability, spec.input, model);
    return { label: spec.label, capability: spec.capability, model: model.label, units, funny: funnyFor(model, settings, units) };
  });
  return { lines, total: lines.reduce((a, l) => a + l.funny, 0) };
}

/** 이번 달 AI 원가 (끝난 작업의 실제 원가 + 진행 중 작업의 예상 원가) */
export function monthCostWon(db: Database): number {
  const from = kstMonthStartIso();
  return (db.ai_jobs ?? [])
    .filter((j) => j.created_at >= from && (j.status === "succeeded" || ACTIVE.includes(j.status)))
    .reduce((sum, j) => sum + (j.cost_won || 0), 0);
}

/**
 * 작업 등록 (반드시 tx 안). 실패하면 예외 → tx 전체 롤백 (일부만 예약되는 일 없음)
 * idempotencyKey: 같은 요청을 두 번 보내도(더블클릭·재전송) 한 번만 등록
 */
export function enqueueSpecs(
  db: Database,
  user: Pick<Profile, "id" | "role" | "status">,
  project: ShortsProject,
  specs: JobSpec[],
  opts: { idempotencyKey?: string | null; allowWhenClosed?: boolean } = {}
): AiJob[] {
  const { jobs } = aiTables(db);
  if (opts.idempotencyKey) {
    const existing = jobs.filter((j) => j.user_id === user.id && j.idempotency_key === opts.idempotencyKey);
    if (existing.length) return existing;
  }
  const access = aiShortsAccess(db, user);
  if (!access.open && !opts.allowWhenClosed) throw new AiError(access.reason, 403, "closed");
  if (!specs.length) throw new AiError("만들 항목이 없습니다. 이미 모두 만들어졌거나 선택한 컷이 없습니다.");
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
  }
  const activeCount = jobs.filter((j) => j.user_id === user.id && ACTIVE.includes(j.status)).length;
  if (activeCount + specs.length > settings.max_active_jobs_per_user) {
    throw new AiError(`동시에 진행할 수 있는 작업은 최대 ${settings.max_active_jobs_per_user}개입니다. 진행 중인 작업이 끝난 뒤 다시 시도해 주세요.`, 429, "too_many");
  }
  for (const spec of specs) {
    const text = `${spec.input.prompt ?? ""} ${spec.input.text ?? ""}`;
    const term = blockedTermIn(text + " " + project.topic, settings);
    if (term) throw new AiError(`사용할 수 없는 표현이 포함되어 있습니다: "${term}"`, 400, "blocked_term");
  }
  const { lines, total } = estimateSpecs(db, specs);

  if (total > 0) {
    // 플랫폼 월 예산
    if (settings.monthly_budget_won > 0) {
      const estCost = specs.reduce((sum, spec) => {
        if (!spec.capability) return sum;
        const m = resolveModel(db, spec.capability)!;
        return sum + costWonFor(m, settings, unitsFor(spec.capability, spec.input, m));
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
  finishFailed(db, job, { status: "cancelled", publicError: isAdmin ? "관리자가 작업을 취소했습니다." : "작업을 취소했습니다.", detail: `cancelled by ${actor.id}` });
  audit(db, { actorId: actor.id, action: "ai_job_cancel", targetTable: "ai_jobs", targetId: job.id });
  return job;
}

// --- 정산 ---------------------------------------------------------------------

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
  s.timer = setInterval(() => void tick(), 1_500);
  s.timer.unref?.();
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
    if (jobs.some((j) => j.status === "running" && j.lease_until && Date.parse(j.lease_until) < now && !s.inflight.has(j.id))) {
      const expired = jobs.filter((j) => j.status === "running" && j.lease_until && Date.parse(j.lease_until) < now && !s.inflight.has(j.id)).map((j) => j.id);
      for (const expiredId of expired) {
       try {
       tx((d) => {
        for (const j of (d.ai_jobs ?? []).filter((x) => x.id === expiredId)) {
          if (j.status !== "running" || !j.lease_until || Date.parse(j.lease_until) >= Date.now() || s.inflight.has(j.id)) continue;
          if (j.kind === "shot_video" && !j.vendor_ref) {
            // 영상 요청을 보내는 중에 서버가 멈췄으면, 이미 접수됐을 수 있어 다시 보내지 않고 환불한다(중복 과금 방지)
            finishFailed(d, j, { publicError: "서버 점검으로 작업이 중단되어 퍼니를 돌려드렸습니다. 다시 시도해 주세요.", detail: "lease expired before vendor_ref" });
            continue;
          }
          j.status = "queued";
          j.worker_id = null;
          j.lease_until = null;
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
          if (!j || !ACTIVE.includes(j.status) || (j.status === "running" && j.lease_until && Date.parse(j.lease_until) > Date.now())) return;
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
        if (aiSlots <= 0) continue;
        aiSlots--;
      }
      const claimed = claim(j.id);
      if (claimed) {
        s.inflight.add(claimed.id);
        void execute(claimed).finally(() => s.inflight.delete(claimed.id));
      }
    }
  } catch (error) {
    console.error("[ai-engine] tick error", error);
  } finally {
    s.ticking = false;
  }
}

function claim(jobId: string): AiJob | null {
  const s = state();
  return tx((db) => {
    const j = (db.ai_jobs ?? []).find((x) => x.id === jobId);
    if (!j || j.status !== "queued") return null;
    if (j.next_poll_at && Date.parse(j.next_poll_at) > Date.now()) return null;
    j.status = "running";
    j.worker_id = s.workerId;
    j.lease_until = new Date(Date.now() + (j.kind === "compose" ? COMPOSE_LEASE_MS : j.vendor_ref ? POLL_LEASE_MS : RUN_LEASE_MS)).toISOString();
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
  try {
    const input: AiInput = { ...(job.input as AiInput) };
    // 관리자가 음성 공급사를 바꾼 경우: 이전 공급사의 목소리 값이면 현재 공급사 기본 목소리로 바꾼다
    if (job.capability === "tts") {
      const voices = VOICES[provider.kind] ?? [];
      if (voices.length && !voices.some((v) => v.id === input.voice)) input.voice = voices[0].id || undefined;
    }
    if (job.kind === "shot_video") {
      const img = await fileBuffer(db, String(job.input.image_file_id || ""));
      if (!img) throw new AiError("영상으로 만들 컷 이미지를 찾을 수 없습니다.", 400);
      input.image = { buffer: img.buffer, mime: img.mime };
    }
    const outcome = job.vendor_ref && adapter.poll
      ? await adapter.poll({ provider, model, capability: job.capability, ref: job.vendor_ref, key })
      : await adapter.run({ provider, model, capability: job.capability, input, key });
    if (outcome.status === "pending") {
      withOwnedJob(job, (_d, j) => {
        j.vendor_ref = outcome.ref;
        j.status = "queued";
        j.worker_id = null;
        j.lease_until = null;
        j.next_poll_at = new Date(Date.now() + (POLL_MS[job.capability!] ?? 3_000)).toISOString();
        j.updated_at = iso();
      });
      return;
    }
    await settleSuccess(job, model, provider, outcome.result);
  } catch (error) {
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
  if (!buffer || !buffer.length) throw new VendorError("AI 결과 파일이 비어 있습니다.");
  const sniff = sniffMime(buffer);
  const expected: Record<string, RegExp> = { shot_image: /^image\//, shot_tts: /^audio\//, music: /^audio\//, shot_video: /^video\// };
  if (!sniff || !expected[job.kind].test(sniff.mime)) throw new VendorError("AI 결과 파일 형식이 올바르지 않습니다.", { retryable: true });
  let audioSeconds: number | null = null;
  if (job.kind === "shot_tts") {
    const tmp = path.join(tmpdir(), `vf-tts-${randomUUID()}.${sniff.ext}`);
    await writeFile(tmp, buffer);
    try {
      audioSeconds = Math.round((await probeMedia(tmp)).duration * 100) / 100;
    } finally {
      await rm(tmp, { force: true }).catch(() => {});
    }
  }
  const saved = await saveResultFile(job.user_id, buffer, sniff.mime, sniff.ext, `${job.kind}-${job.id}.${sniff.ext}`);
  const committed = withOwnedJob(job, (db, j) => {
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
  if (!committed) {
    // 관리자 취소 등으로 이미 정산된 작업 → 저장한 파일만 지운다
    await storage.delete(saved.storage_name).catch(() => {});
  }
  await flushCleanup();
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
    const vendorFault = isVendor && (err.status === 401 || err.status === 403 || err.retryable !== false);
    if (vendorFault) {
      const p = (db.ai_providers ?? []).find((x) => x.id === provider.id);
      if (p) {
        p.fail_streak = (p.fail_streak || 0) + 1;
        if (p.fail_streak >= BREAKER_FAILURES || err.status === 401) {
          p.cooldown_until = new Date(Date.now() + BREAKER_COOLDOWN_MS).toISOString();
          notifyAdmins(db, { title: "AI 공급사 연속 실패", message: `${p.name} 호출이 연속으로 실패해 10분간 사용을 멈췄습니다. API 키·잔액·공급사 상태를 확인하세요.`, link: "/admin/ai-shorts/providers" });
        }
        p.updated_at = iso();
      }
    }
    const scriptRetry = error instanceof ScriptParseError && j.attempts < 2;
    // 영상은 요청 접수 여부를 모를 때(시간 초과) 다시 보내지 않는다 → 중복 과금 방지
    const unsafeResend = j.kind === "shot_video" && !j.vendor_ref && isVendor && err.unknownDelivery;
    const retry = scriptRetry || (isVendor && err.retryable !== false && !unsafeResend && j.attempts < MAX_ATTEMPTS && !(j.vendor_ref && !err.transient));
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
