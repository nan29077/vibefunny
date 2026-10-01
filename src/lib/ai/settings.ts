import type { AiCapability, AiShortsSettings, Database, Profile } from "../schema";
import { FUNNY_WON } from "../funny";

// ===========================================================================
// AI 숏츠 제작 — 최고관리자 설정과 이용 가능 여부
// ===========================================================================

export const AI_CAPABILITIES: AiCapability[] = ["text", "image", "tts", "video", "music"];

export const CAPABILITY_LABELS: Record<AiCapability, string> = {
  text: "대본 작성",
  image: "컷 이미지",
  tts: "내레이션 음성",
  video: "AI 영상 클립",
  music: "배경음악",
};

export const UNIT_LABELS: Record<AiCapability, string> = {
  text: "1천 토큰",
  image: "1장",
  tts: "1천 자",
  video: "1초",
  music: "1초",
};

export function defaultAiShortsSettings(): AiShortsSettings {
  return {
    enabled: false,
    audience: "all",
    allowed_creator_ids: [],
    won_per_funny: FUNNY_WON,
    usd_krw_rate: 1400,
    margin_rate: 180,
    monthly_budget_won: 1_000_000,
    daily_limit_funny: 20_000,
    max_active_jobs_per_user: 20,
    concurrency: 3,
    default_models: {},
    charge_products: [
      { id: "p10000", won: 10_000, bonus: 0 },
      { id: "p30000", won: 30_000, bonus: 150 },
      { id: "p50000", won: 50_000, bonus: 400 },
      { id: "p100000", won: 100_000, bonus: 1_000 },
    ],
    blocked_terms: "",
    budget_alert_sent_month: null,
    updated_at: null,
  };
}

/** 저장된 설정 + 누락 필드 기본값 (구버전 db.json 호환) */
export function getAiShortsSettings(db: Database): AiShortsSettings {
  const base = defaultAiShortsSettings();
  const s = db.settings.ai_shorts;
  if (!s) return base;
  return {
    ...base,
    ...s,
    won_per_funny: FUNNY_WON, // 1퍼니 = 10원 고정
    allowed_creator_ids: Array.isArray(s.allowed_creator_ids) ? s.allowed_creator_ids : [],
    default_models: s.default_models ?? {},
    charge_products: Array.isArray(s.charge_products) && s.charge_products.length ? s.charge_products : base.charge_products,
  };
}

/**
 * 크리에이터가 AI 숏츠 제작(새 작업·퍼니 충전)을 쓸 수 있는지.
 * 스위치가 꺼져 있거나 대상이 아니면 false. (설정은 매 요청마다 DB에서 새로 읽어 즉시 반영된다)
 */
export function aiShortsAccess(db: Database, user: Pick<Profile, "id" | "role" | "status"> | null): { open: boolean; reason: string } {
  const s = getAiShortsSettings(db);
  if (!user || user.role !== "creator" || user.status !== "active") return { open: false, reason: "크리에이터 계정에서만 이용할 수 있습니다." };
  if (!s.enabled) return { open: false, reason: "AI 숏츠 제작이 현재 운영 중이 아닙니다." };
  if (s.audience === "selected" && !s.allowed_creator_ids.includes(user.id)) {
    return { open: false, reason: "AI 숏츠 제작은 현재 일부 크리에이터에게만 먼저 제공되고 있습니다." };
  }
  return { open: true, reason: "" };
}

/** 메뉴 노출 여부 (스위치 OFF여도 이전에 만든 숏츠가 있으면 결과 보기용으로 메뉴는 남긴다) */
export function aiShortsMenuVisible(db: Database, user: Pick<Profile, "id" | "role" | "status">): boolean {
  if (aiShortsAccess(db, user).open) return true;
  return (db.shorts_projects ?? []).some((p) => p.user_id === user.id) || (db.funny_wallets ?? []).some((w) => w.user_id === user.id);
}

export function blockedTermIn(text: string, settings: AiShortsSettings): string | null {
  const terms = settings.blocked_terms
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const lower = text.toLowerCase();
  return terms.find((t) => lower.includes(t.toLowerCase())) ?? null;
}

export const kstMonthKey = (d = new Date()) => {
  const k = new Date(d.getTime() + 9 * 3600_000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const kstDayStartIso = () => {
  const k = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600_000).toISOString();
};
export const kstMonthStartIso = () => {
  const k = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3600_000).toISOString();
};
