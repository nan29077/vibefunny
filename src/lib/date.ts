// ===========================================================================
// 날짜/시간 표시 유틸 - 앱에 표시되는 모든 일시는 한국 표준시(KST, Asia/Seoul) 기준.
// 저장은 UTC/ISO를 유지하되, 표시는 항상 KST로 통일한다.
// 사용자 로컬 타임존과 무관하게 동일한 결과를 보장한다.
// ===========================================================================

const KST = "Asia/Seoul";

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * KST 기준 YYYY-MM-DD. ISO 문자열의 `.slice(0, 10)`(UTC) 대체용.
 * "2025-01-15T20:00:00Z" -> "2025-01-16" (KST)
 */
export function formatDate(value: DateInput): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 보장한다.
  return toDate(value).toLocaleDateString("en-CA", { timeZone: KST });
}

/**
 * KST 기준 ko-KR 날짜 표시. 옵션으로 형식 지정 가능.
 */
export function formatDateKo(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return toDate(value).toLocaleDateString("ko-KR", { timeZone: KST, ...options });
}

/**
 * KST 기준 ko-KR 날짜+시간 표시. 옵션으로 형식 지정 가능.
 */
export function formatDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return toDate(value).toLocaleString("ko-KR", { timeZone: KST, ...options });
}

/**
 * KST 기준 짧은 일시 (월/일 시:분) - 댓글/메시지 타임스탬프용.
 */
export function formatShortDateTime(value: DateInput): string {
  return toDate(value).toLocaleString("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
