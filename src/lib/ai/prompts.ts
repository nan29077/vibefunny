import { z } from "zod";

// ===========================================================================
// AI 숏츠 대본 프롬프트 (숏폼 드라마가 아닌 15~60초 단일 숏츠용)
// - 첫 1~3초 훅 → 핵심 내용 → 마지막 컷 행동 유도(구독·좋아요·댓글)
// - 컷마다 내레이션(음성) · 화면 자막 · 장면 묘사(이미지/영상 프롬프트) · 카메라 움직임 · 길이
// ===========================================================================

export const SHORTS_TEMPLATES: Array<{ id: string; label: string; desc: string; guide: string }> = [
  { id: "info", label: "정보·꿀팁", desc: "알아두면 좋은 정보를 빠르게", guide: "유용한 정보를 3~5개 핵심 포인트로 빠르게 전달한다. 숫자·구체적 예시를 넣는다." },
  { id: "meme", label: "밈·유머", desc: "공감 가는 웃긴 상황", guide: "누구나 공감할 일상 상황을 과장해 웃기게 보여 준다. 반전 한 번을 넣는다. 비하·혐오 표현 금지." },
  { id: "review", label: "제품 리뷰", desc: "제품 장단점 한눈에", guide: "제품의 첫인상, 핵심 장점 2~3개, 아쉬운 점 1개, 추천 대상 순서로 정리한다. 과장·허위 효능 표현 금지." },
  { id: "news", label: "이슈 요약", desc: "화제 이슈를 30초 요약", guide: "무슨 일인지 → 왜 중요한지 → 앞으로 볼 점 순서로 중립적으로 요약한다. 확인되지 않은 사실은 단정하지 않는다." },
  { id: "ranking", label: "TOP 랭킹", desc: "순위로 보는 추천", guide: "TOP 3~5 순위를 낮은 순위부터 1위까지 카운트다운한다. 1위 직전에 기대감을 높인다." },
  { id: "story", label: "썰·스토리", desc: "짧은 이야기로 몰입", guide: "1인칭 썰 형식으로 짧은 이야기를 들려준다. 마지막에 반전이나 교훈을 둔다." },
];

export const TONES = ["밝고 경쾌하게", "차분하고 신뢰감 있게", "유머러스하게", "감성적으로", "긴박하고 빠르게"];

export const CAMERA_MOVES = ["천천히 다가가기", "천천히 멀어지기", "왼쪽으로 패닝", "오른쪽으로 패닝", "위로 틸트", "아래로 틸트", "고정", "핸드헬드"];

export function scriptPrompt(p: { topic: string; template: string; tone: string; target_seconds: number; extra?: string }) {
  const tpl = SHORTS_TEMPLATES.find((t) => t.id === p.template) ?? SHORTS_TEMPLATES[0];
  const shotsHint = Math.max(3, Math.min(10, Math.round(p.target_seconds / 5)));
  const system = [
    "너는 한국어 유튜브 쇼츠·인스타 릴스 전문 작가다. 세로(9:16) 15~60초 숏츠 한 편의 대본을 JSON 으로만 답한다.",
    "규칙:",
    "- 첫 컷은 1~3초 안에 시청자를 붙잡는 강한 훅(질문·충격·공감)으로 시작한다.",
    "- 마지막 컷은 구독·좋아요·댓글 등 행동 유도로 끝낸다.",
    "- narration: 실제로 읽힐 한국어 문장. 컷 길이(초)당 약 6~7글자를 넘지 않게 짧게.",
    "- caption: 화면에 크게 보일 한국어 자막, 18자 이내, 핵심 단어 위주.",
    "- visual: 이미지·영상 생성용 영어 장면 묘사. 세로 구도, 인물·사물·배경·조명을 구체적으로. 화면 속 글자·로고·실존 인물·브랜드 금지.",
    `- camera_move: 다음 중 하나 — ${CAMERA_MOVES.join(", ")}`,
    "- seconds: 2~8 사이 정수. 모든 컷 seconds 합이 목표 길이와 비슷해야 한다.",
    "- 허위·과장 광고, 의료·금융 단정, 혐오·선정 표현 금지.",
    '출력 형식: {"title":"","hook":"","description":"","hashtags":[""],"bgm_prompt":"(English, instrumental mood)","shots":[{"narration":"","caption":"","visual":"","camera_move":"","seconds":4}]}',
  ].join("\n");
  const context = { topic: p.topic, template: tpl.id, target_seconds: p.target_seconds };
  const prompt = [
    `주제: ${p.topic}`,
    `형식: ${tpl.label} — ${tpl.guide}`,
    `말투: ${p.tone}`,
    `목표 길이: 약 ${p.target_seconds}초, 컷 ${shotsHint}개 내외`,
    p.extra ? `추가 요청: ${p.extra}` : "",
    `<context>${JSON.stringify(context)}</context>`,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, prompt, maxTokens: 3000, json: true };
}

const shotSchema = z.object({
  narration: z.string().default(""),
  caption: z.string().default(""),
  visual: z.string().default(""),
  camera_move: z.string().default("천천히 다가가기"),
  seconds: z.coerce.number().default(4),
});
const scriptSchema = z.object({
  title: z.string().default(""),
  hook: z.string().default(""),
  description: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  bgm_prompt: z.string().default(""),
  shots: z.array(shotSchema).min(1),
});
export type ParsedScript = z.infer<typeof scriptSchema>;

export class ScriptParseError extends Error {}

/** AI 응답에서 JSON 을 꺼내 검증·정리한다. 형식이 깨졌으면 ScriptParseError (엔진이 한 번 더 시도) */
export function parseScript(text: string, targetSeconds: number): ParsedScript {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ScriptParseError("AI 대본 형식이 올바르지 않습니다.");
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new ScriptParseError("AI 대본 형식이 올바르지 않습니다.");
  }
  const parsed = scriptSchema.safeParse(raw);
  if (!parsed.success) throw new ScriptParseError("AI 대본에 컷이 없습니다.");
  const out = parsed.data;
  out.shots = out.shots.slice(0, 12).map((s) => ({
    narration: s.narration.trim().slice(0, 200),
    caption: s.caption.trim().slice(0, 40),
    visual: s.visual.trim().slice(0, 800),
    camera_move: CAMERA_MOVES.includes(s.camera_move) ? s.camera_move : "천천히 다가가기",
    seconds: Math.max(2, Math.min(10, Math.round(Number(s.seconds) || 4))),
  }));
  // 총 길이를 목표(±30%)에 맞춘다
  const sum = out.shots.reduce((a, s) => a + s.seconds, 0);
  if (sum > targetSeconds * 1.3 || sum < targetSeconds * 0.7) {
    const k = targetSeconds / Math.max(1, sum);
    out.shots = out.shots.map((s) => ({ ...s, seconds: Math.max(2, Math.min(10, Math.round(s.seconds * k))) }));
  }
  out.title = out.title.trim().slice(0, 80);
  out.hook = out.hook.trim().slice(0, 200);
  out.description = out.description.trim().slice(0, 1000);
  out.hashtags = out.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean).slice(0, 10);
  out.bgm_prompt = out.bgm_prompt.trim().slice(0, 300);
  return out;
}

/** 장면 묘사에 한글이 있으면 모델이 영어로 이해해 그리도록 안내한다 (크리에이터는 한국어로 써도 된다) */
const hasKorean = (text: string) => /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
const koreanNote = (visual: string) =>
  hasKorean(visual)
    ? " (The scene description above may be written in Korean: understand it as if translated into English and depict it faithfully. Do not render any Korean or other text in the image.)"
    : "";

/** 이미지 프롬프트: 세로 구도 + 글자 없음 */
export function imagePrompt(visual: string): string {
  return `${visual.trim()}.${koreanNote(visual)} Vertical 9:16 composition, high quality, vivid, no text, no letters, no watermark, no logo.`;
}

/** 영상 프롬프트: 컷 이미지에서 시작하는 짧은 움직임 */
export function videoPrompt(visual: string, move: string): string {
  const motion: Record<string, string> = {
    "천천히 다가가기": "slow push-in camera",
    "천천히 멀어지기": "slow pull-out camera",
    "왼쪽으로 패닝": "smooth pan to the left",
    "오른쪽으로 패닝": "smooth pan to the right",
    "위로 틸트": "tilt up",
    "아래로 틸트": "tilt down",
    고정: "static camera, subtle natural motion",
    핸드헬드: "handheld camera, slight shake",
  };
  return `${visual.trim()}.${koreanNote(visual)} ${motion[move] ?? "slow push-in camera"}, natural motion, vertical video, no text.`;
}
