import type { AiCapability, AiShortsSettings, Database, Profile } from "../schema";
import { FUNNY_WON } from "../funny";
import { resolveModel } from "./readiness";
import { isVibeMember, VIBE_ONLY_MESSAGE } from "../membership";

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
export function aiShortsAccess(db: Database, user: (Pick<Profile, "id" | "role" | "status"> & { vibe_member_at?: string | null }) | null): { open: boolean; reason: string } {
  const s = getAiShortsSettings(db);
  if (!user || user.role !== "creator" || user.status !== "active") return { open: false, reason: "크리에이터 계정에서만 이용할 수 있습니다." };
  // 가입비를 결제한 바이브회원만
  if (!isVibeMember(db, user)) return { open: false, reason: VIBE_ONLY_MESSAGE };
  if (!s.enabled) return { open: false, reason: "AI 숏츠 제작이 현재 운영 중이 아닙니다." };
  if (s.audience === "selected" && !s.allowed_creator_ids.includes(user.id)) {
    return { open: false, reason: "AI 숏츠 제작은 현재 일부 크리에이터에게만 먼저 제공되고 있습니다." };
  }
  return { open: true, reason: "" };
}

/** 대본 AI 가 준비돼 있어 실제로 새 숏츠를 만들 수 있는가 (대본이 없으면 다른 단계도 시작할 수 없다) */
export function aiShortsUsable(db: Database): boolean {
  return !!resolveModel(db, "text");
}

/** 대본·이미지·음성 중 준비되지 않은 작업 (관리자 경고용) */
export function missingRequiredCapabilities(db: Database): AiCapability[] {
  return (["text", "image", "tts"] as AiCapability[]).filter((cap) => !resolveModel(db, cap));
}

/**
 * 메뉴 노출 여부.
 * - 이용 가능(스위치 ON·대상)하고 대본 AI 가 준비돼 있으면 노출
 * - 그렇지 않아도 이전에 만든 숏츠나 퍼니 지갑이 있으면 결과 보기·잔액 확인용으로 남긴다
 */
export function aiShortsMenuVisible(db: Database, user: Pick<Profile, "id" | "role" | "status">): boolean {
  if (aiShortsAccess(db, user).open && aiShortsUsable(db)) return true;
  return (db.shorts_projects ?? []).some((p) => p.user_id === user.id) || (db.funny_wallets ?? []).some((w) => w.user_id === user.id);
}

/**
 * 퍼니 충전을 받아도 되는가 — 이용 가능(스위치 ON·대상) + 대본 AI 준비.
 * 충전 요청 생성 시와, 결제 완료 후 퍼니를 지급하기 직전(payment effects)에 다시 확인한다.
 */
export function funnyChargeAllowed(db: Database, user: Pick<Profile, "id" | "role" | "status"> | null): { ok: boolean; reason?: string } {
  const access = aiShortsAccess(db, user);
  if (!access.open) return { ok: false, reason: access.reason };
  if (!aiShortsUsable(db)) return { ok: false, reason: "AI 숏츠 제작 준비가 아직 끝나지 않아 지금은 퍼니를 충전할 수 없습니다." };
  return { ok: true };
}

/**
 * 금칙어 비교용 정규화: 호환 문자 통일(NFKC) · 소문자 · 공백/제로폭 문자/문장부호/기호 제거
 * → "도 박", "도.박", "ｄｏｂａｋ", "도\u200B박" 같은 우회를 막는다.
 */
export function normalizeForMatch(text: string): string {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}\p{Cf}\p{Cc}\u3164\u115F\u1160]/gu, "");
}

export function blockedTermIn(text: string, settings: Pick<AiShortsSettings, "blocked_terms">): string | null {
  const terms = String(settings.blocked_terms || "")
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!terms.length) return null;
  const hay = normalizeForMatch(text);
  return terms.find((t) => {
    const needle = normalizeForMatch(t);
    return needle.length > 0 && hay.includes(needle);
  }) ?? null;
}

/** 여러 문장을 한 번에 검사 (각 문장 따로 — 문장 경계를 넘어 붙은 우연한 일치를 피한다) */
export function blockedTermInAny(texts: Array<string | null | undefined>, settings: Pick<AiShortsSettings, "blocked_terms">): string | null {
  for (const t of texts) {
    if (!t) continue;
    const hit = blockedTermIn(t, settings);
    if (hit) return hit;
  }
  return null;
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
