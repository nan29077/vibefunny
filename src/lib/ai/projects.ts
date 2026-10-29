import { z } from "zod";
import { genId } from "../crypto";
import type { AiJob, Database, Profile, ShortsProject, ShortsShot } from "../schema";
import { AiError, aiTables, composeSignature, markFilesForCleanup } from "./engine";
import { CAMERA_MOVES, SHORTS_TEMPLATES, TONES } from "./prompts";
import { blockedTermIn, blockedTermInAny, getAiShortsSettings } from "./settings";

// ===========================================================================
// AI 숏츠 프로젝트 (숏츠 1편 = 프로젝트 1개, 컷 3~12개)
// ===========================================================================

const iso = () => new Date().toISOString();
const ACTIVE: AiJob["status"][] = ["queued", "running"];
export const MAX_SHOTS = 12;
export const MAX_PROJECTS_PER_USER = 200;

export const createSchema = z.object({
  topic: z.string().trim().min(2, "주제를 2자 이상 입력하세요.").max(300, "주제는 300자 이내로 입력하세요."),
  template: z.string().refine((v) => SHORTS_TEMPLATES.some((t) => t.id === v), "형식을 선택하세요."),
  tone: z.string().refine((v) => TONES.includes(v), "말투를 선택하세요."),
  target_seconds: z.coerce.number().refine((v) => [15, 30, 45, 60].includes(v), "길이를 선택하세요."),
  voice: z.string().max(80).default(""),
  title: z.string().trim().max(80).default(""),
});

const shotPatch = z.object({
  id: z.string().max(64).optional(),
  narration: z.string().max(200).default(""),
  caption: z.string().max(40).default(""),
  visual: z.string().max(800).default(""),
  camera_move: z.string().refine((v) => CAMERA_MOVES.includes(v), "카메라 움직임 값이 올바르지 않습니다.").default("천천히 다가가기"),
  seconds: z.coerce.number().int().min(2).max(10).default(4),
  use_video: z.boolean().default(false),
});

export const patchSchema = z.object({
  title: z.string().trim().max(80).optional(),
  topic: z.string().trim().min(2).max(300).optional(),
  template: z.string().refine((v) => SHORTS_TEMPLATES.some((t) => t.id === v)).optional(),
  tone: z.string().refine((v) => TONES.includes(v)).optional(),
  target_seconds: z.coerce.number().refine((v) => [15, 30, 45, 60].includes(v)).optional(),
  voice: z.string().max(80).optional(),
  description: z.string().max(1000).optional(),
  hashtags: z.array(z.string().max(40)).max(15).optional(),
  bgm_prompt: z.string().max(300).optional(),
  bgm_volume: z.coerce.number().min(0).max(1).optional(),
  subtitle_position: z.enum(["bottom", "middle", "top"]).optional(),
  shots: z.array(shotPatch).max(MAX_SHOTS, `컷은 최대 ${MAX_SHOTS}개까지 만들 수 있습니다.`).optional(),
  remove_bgm: z.boolean().optional(),
});

export function getOwnedProject(db: Database, user: Pick<Profile, "id" | "role">, projectId: string): ShortsProject {
  const project = (db.shorts_projects ?? []).find((p) => p.id === projectId);
  if (!project) throw new AiError("숏츠를 찾을 수 없습니다.", 404);
  if (project.user_id !== user.id && user.role !== "admin") throw new AiError("본인 숏츠만 볼 수 있습니다.", 403);
  return project;
}

export function createProject(db: Database, user: Pick<Profile, "id">, input: z.infer<typeof createSchema>): ShortsProject {
  const { projects } = aiTables(db);
  if (projects.filter((p) => p.user_id === user.id).length >= MAX_PROJECTS_PER_USER) {
    throw new AiError(`숏츠는 최대 ${MAX_PROJECTS_PER_USER}개까지 보관할 수 있습니다. 필요 없는 숏츠를 삭제해 주세요.`);
  }
  const project: ShortsProject = {
    id: genId(),
    user_id: user.id,
    title: input.title,
    template: input.template,
    topic: input.topic,
    tone: input.tone,
    target_seconds: input.target_seconds,
    voice: input.voice,
    hook: "",
    description: "",
    hashtags: [],
    shots: [],
    bgm_prompt: "",
    bgm_file_id: null,
    bgm_volume: 0.2,
    subtitle_position: "bottom",
    status: "draft",
    output_file_id: null,
    output_seconds: null,
    compose_error: null,
    created_at: iso(),
    updated_at: iso(),
  };
  projects.push(project);
  return project;
}

/** 저장 전 금칙어 검사 (정규화 후 비교 — 띄어쓰기·특수문자 우회 차단) */
export function assertNoBlockedTerms(db: Database, patch: Partial<z.infer<typeof patchSchema>>) {
  const settings = getAiShortsSettings(db);
  const blocked = (term: string, where: string) => new AiError(`${where}에 사용할 수 없는 표현이 포함되어 있습니다: "${term}"`, 400, "blocked_term");
  const fields: Array<[string | undefined, string]> = [
    [patch.title, "제목"],
    [patch.topic, "주제"],
    [patch.description, "업로드 설명"],
    [patch.bgm_prompt, "배경음악 분위기"],
    ...(patch.hashtags ?? []).map((h): [string, string] => [h, "해시태그"]),
  ];
  for (const [text, where] of fields) {
    const term = text ? blockedTermIn(text, settings) : null;
    if (term) throw blocked(term, where);
  }
  (patch.shots ?? []).forEach((sp, i) => {
    const term = blockedTermInAny([sp.caption, sp.narration, sp.visual], settings);
    if (term) throw blocked(term, `${i + 1}번 컷`);
  });
}

export function updateProject(db: Database, project: ShortsProject, patch: z.infer<typeof patchSchema>): ShortsProject {
  assertNoBlockedTerms(db, patch);
  const cleanup: string[] = [];
  if (patch.title !== undefined) project.title = patch.title;
  if (patch.topic !== undefined) project.topic = patch.topic;
  if (patch.template !== undefined) project.template = patch.template;
  if (patch.tone !== undefined) project.tone = patch.tone;
  if (patch.target_seconds !== undefined) project.target_seconds = patch.target_seconds;
  if (patch.voice !== undefined) project.voice = patch.voice;
  if (patch.description !== undefined) project.description = patch.description;
  if (patch.hashtags !== undefined) project.hashtags = patch.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  if (patch.bgm_prompt !== undefined) project.bgm_prompt = patch.bgm_prompt;
  if (patch.bgm_volume !== undefined) project.bgm_volume = patch.bgm_volume;
  if (patch.subtitle_position !== undefined) project.subtitle_position = patch.subtitle_position;
  if (patch.remove_bgm && project.bgm_file_id) {
    cleanup.push(project.bgm_file_id);
    project.bgm_file_id = null;
  }
  if (patch.shots) {
    const byId = new Map(project.shots.map((s) => [s.id, s]));
    // 화면이 오래된 대본(이미 바뀐 컷 id)을 들고 저장하려는 경우 → 새 대본을 덮어쓰지 않도록 거절
    if (patch.shots.some((sp) => sp.id && !byId.has(sp.id))) {
      throw new AiError("그 사이 대본이 새로 바뀌었습니다. 화면을 새로고침한 뒤 다시 편집해 주세요.", 409, "stale");
    }
    if ((db.ai_jobs ?? []).some((j) => j.project_id === project.id && j.kind === "script" && ACTIVE.includes(j.status))) {
      throw new AiError("대본을 만드는 중에는 컷을 수정할 수 없습니다. 대본이 완성된 뒤 다시 시도해 주세요.", 409, "busy");
    }
    const next: ShortsShot[] = patch.shots.map((sp) => {
      const prev = sp.id ? byId.get(sp.id) : undefined;
      if (prev) byId.delete(prev.id);
      return {
        id: prev?.id ?? genId(),
        narration: sp.narration,
        caption: sp.caption,
        visual: sp.visual,
        camera_move: sp.camera_move,
        seconds: sp.seconds,
        // 영상 클립이 없으면 영상 사용을 켤 수 없다
        use_video: !!(sp.use_video && prev?.video_file_id),
        image_file_id: prev?.image_file_id ?? null,
        audio_file_id: prev?.audio_file_id ?? null,
        audio_seconds: prev?.audio_seconds ?? null,
        audio_text: prev?.audio_text ?? null,
        video_file_id: prev?.video_file_id ?? null,
      };
    });
    // 삭제한 컷의 결과물 정리 (진행 중 작업이 있는 컷은 삭제 불가)
    const activeShotIds = new Set((db.ai_jobs ?? []).filter((j) => j.project_id === project.id && ACTIVE.includes(j.status) && j.shot_id).map((j) => j.shot_id));
    for (const removed of byId.values()) {
      if (activeShotIds.has(removed.id)) throw new AiError("AI 작업이 진행 중인 컷은 삭제할 수 없습니다. 작업이 끝난 뒤 다시 시도해 주세요.", 409);
      for (const f of [removed.image_file_id, removed.audio_file_id, removed.video_file_id]) if (f) cleanup.push(f);
    }
    project.shots = next;
    if (project.status === "draft" && next.length) project.status = "scripted";
  }
  project.updated_at = iso();
  markFilesForCleanup(db, cleanup);
  return project;
}

export function deleteProject(db: Database, project: ShortsProject) {
  if ((db.ai_jobs ?? []).some((j) => j.project_id === project.id && ACTIVE.includes(j.status))) {
    throw new AiError("진행 중인 작업이 있어 삭제할 수 없습니다. 작업이 끝난 뒤 다시 시도해 주세요.", 409);
  }
  const files = [
    ...project.shots.flatMap((s) => [s.image_file_id, s.audio_file_id, s.video_file_id]),
    project.bgm_file_id,
    project.output_file_id,
  ].filter(Boolean) as string[];
  db.shorts_projects = (db.shorts_projects ?? []).filter((p) => p.id !== project.id);
  markFilesForCleanup(db, files);
}

/** 화면용 요약: 컷·작업 상태 */
export function projectView(db: Database, project: ShortsProject) {
  const jobs = (db.ai_jobs ?? []).filter((j) => j.project_id === project.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const active = jobs.filter((j) => ACTIVE.includes(j.status));
  const lastByKey = new Map<string, AiJob>();
  for (const j of jobs) {
    const key = `${j.kind}:${j.shot_id ?? ""}`;
    if (!lastByKey.has(key)) lastByKey.set(key, j);
  }
  const jobBrief = (j: AiJob | undefined) =>
    j
      ? {
          id: j.id,
          status: j.status,
          error: j.status === "failed" || j.status === "cancelled" ? j.error : null,
          progress: j.progress,
          charged: j.charged_funny,
          held: j.hold_paid + j.hold_bonus,
          canCancel: j.status === "queued" && !j.vendor_ref,
          createdAt: j.created_at,
          finishedAt: j.finished_at,
        }
      : null;
  // 마지막으로 성공한 합성 이후 합성 재료가 바뀌었는가
  const lastComposed = jobs.find((j) => j.kind === "compose" && j.status === "succeeded" && j.result_file_id === project.output_file_id);
  const composedSig = lastComposed && typeof lastComposed.input?.signature === "string" ? (lastComposed.input.signature as string) : null;
  const needsRecompose = !!project.output_file_id && !!composedSig && composedSig !== composeSignature(project);
  // 컷별 마지막 성공 시각 (그 이후로는 예전 실패 메시지를 숨긴다)
  const lastShotSuccess: Record<string, string> = {};
  for (const j of jobs) {
    if (j.shot_id && j.status === "succeeded" && j.finished_at && !(lastShotSuccess[j.shot_id] > j.finished_at)) lastShotSuccess[j.shot_id] = j.finished_at;
  }
  return {
    project,
    activeCount: active.length,
    composeJob: jobBrief(lastByKey.get("compose:")),
    scriptJob: jobBrief(lastByKey.get("script:")),
    musicJob: jobBrief(lastByKey.get("music:")),
    shotJobs: Object.fromEntries(
      project.shots.map((s) => [
        s.id,
        {
          image: jobBrief(lastByKey.get(`shot_image:${s.id}`)),
          tts: jobBrief(lastByKey.get(`shot_tts:${s.id}`)),
          video: jobBrief(lastByKey.get(`shot_video:${s.id}`)),
        },
      ])
    ),
    needsRecompose,
    lastShotSuccess,
    spent: jobs.reduce((sum, j) => sum + (j.status === "succeeded" ? j.charged_funny : 0), 0),
  };
}
export type ProjectView = ReturnType<typeof projectView>;
