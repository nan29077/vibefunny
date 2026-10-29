import type { AppSettings } from "./schema";

// ===========================================================================
// 공개(마케팅) 페이지 문구에 쓰는 값 — 하드코딩 대신 관리자 정책 설정을 읽는다.
// ===========================================================================

/** 크리에이터 가입비 (0이면 무료) */
export function creatorSignupFee(settings: AppSettings): number {
  const fee = settings.fees?.creator;
  return fee?.signup_fee_enabled && fee.signup_fee_amount > 0 ? fee.signup_fee_amount : 0;
}

/** "가입비 0원" / "가입비 990,000원" */
export function signupFeeLabel(settings: AppSettings): string {
  const fee = creatorSignupFee(settings);
  return `가입비 ${fee.toLocaleString("ko-KR")}원`;
}

/** 크리에이터 추천 1건당 수당 (실제 지급 로직 services.createSignupReferralReward 와 동일 기준) */
export function creatorReferralReward(settings: AppSettings): number {
  const roleAmount = settings.fees?.creator?.referral_reward_amount ?? 0;
  return Math.max(0, roleAmount); // 정책 설정의 역할별 금액 그대로 (0원 = 지급 안 함)
}

export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}`;
