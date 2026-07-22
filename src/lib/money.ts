// ===========================================================================
// 금액(KRW) 유틸 - 모든 금액은 정수(원). 계산은 서버에서만 신뢰한다.
// ===========================================================================

/** 100000 -> "100,000원" */
export function formatKRW(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

/** 100000 -> "100,000P" */
export function formatPoint(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}P`;
}

/**
 * 비율(%) 적용 - 정수 원 단위로 내림.
 * percentOf(10000, 20) === 2000
 */
export function percentOf(amount: number, ratePercent: number): number {
  return Math.floor((amount * ratePercent) / 100);
}

/** 플랫폼 수수료 차감 후 정산액 = amount - floor(amount * feeRate/100) */
export function netAfterFee(amount: number, feeRatePercent: number): number {
  return amount - percentOf(amount, feeRatePercent);
}

/** 안전한 양의 정수 파싱 (클라이언트 입력 검증용 보조) */
export function toPositiveInt(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
