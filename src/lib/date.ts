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

/**
 * 마감 시각(ms). "YYYY-MM-DD" 는 그날 한국 시간 23:59:59.999 까지로 본다
 * (new Date("YYYY-MM-DD") 는 UTC 자정이라 한국 시간 오전 9시에 마감되는 문제 방지). 해석 불가면 null.
 */
export function deadlineEndMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999+09:00` : value);
  return Number.isNaN(t) ? null : t;
}

/** 마감일까지 남은 일수(오늘 마감이면 0, 지났으면 음수). 해석 불가면 null */
export function daysUntilDeadline(value: string | null | undefined, now: number = Date.now()): number | null {
  const end = deadlineEndMs(value);
  if (end === null) return null;
  if (end < now) return -1;
  return Math.floor((end - now) / (1000 * 60 * 60 * 24));
}
