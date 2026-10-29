// ===========================================================================
// 크리에이터 회원 등급
// - 일반회원: 가입은 했지만 가입비를 결제하지 않은 회원. 로그인·대시보드·내 정보·SNS 계정 등록·문의만 이용
// - 바이브회원: 가입비를 결제한 회원. 캠페인·영상 제작 의뢰·쇼츠 커머스·AI 숏츠·출금·SNS 맞구독 이용,
//   본인 추천 코드로 멘티를 받을 수 있다(멘토)
// 가입비 제도가 꺼져 있으면(가입비 0원·미사용) 크리에이터는 가입 즉시 바이브회원이다.
// 광고주·관리자는 등급 구분이 없다(항상 이용 가능).
// ===========================================================================
import type { Database, Profile } from "./schema";

export const GENERAL_MEMBER_LABEL = "일반회원";
export const VIBE_MEMBER_LABEL = "바이브회원";

/** 크리에이터 가입비 제도가 켜져 있는지 */
export function creatorSignupFeeRequired(db: Database): boolean {
  const fee = db.settings.fees.creator;
  return !!fee?.signup_fee_enabled && (fee.signup_fee_amount ?? 0) > 0;
}

/** 바이브회원(유료 기능 이용 가능) 여부 */
export function isVibeMember(db: Database, user: Pick<Profile, "role" | "vibe_member_at">): boolean {
  if (user.role !== "creator") return true;
  if (user.vibe_member_at) return true;
  return !creatorSignupFeeRequired(db);
}

/** 화면 표시용 등급 이름 (크리에이터만) */
export function memberGradeLabel(db: Database, user: Pick<Profile, "role" | "vibe_member_at">): string | null {
  if (user.role !== "creator") return null;
  return isVibeMember(db, user) ? VIBE_MEMBER_LABEL : GENERAL_MEMBER_LABEL;
}

/**
 * 크리에이터 가입 때 추천인(멘토) 코드로 쓸 수 있는지
 * - 활성 바이브회원 크리에이터
 * - 최고관리자 코드(회사 추천 코드) — 첫 회원을 받거나 추천인이 없는 지원자를 받을 때 사용, 추천 수당은 없음
 */
export function canBeMentor(db: Database, user: Pick<Profile, "role" | "status" | "vibe_member_at">): boolean {
  if (user.status !== "active") return false;
  if (user.role === "admin") return true;
  return user.role === "creator" && isVibeMember(db, user);
}

export const VIBE_ONLY_MESSAGE = "가입비를 결제한 바이브회원만 이용할 수 있습니다. 대시보드에서 가입비를 결제해 주세요.";

/** 바이브회원 전용 기능 검사: 막아야 하면 안내 문구, 통과면 null */
export function vibeOnlyError(db: Database, user: Pick<Profile, "role" | "vibe_member_at">): string | null {
  return isVibeMember(db, user) ? null : VIBE_ONLY_MESSAGE;
}
