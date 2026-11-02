import type { AppSettings } from "./schema";

export const DEFAULT_SUPPORT_HOURS = {
  enabled: true,
  weekdaysOnly: true,
  start: "10:00",
  end: "17:00",
  timezone: "Asia/Seoul",
} as const;

export type SupportAvailability = {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  isOpen: boolean;
  currentTime: string;
  label: string;
  closedMessage: string;
};

const validTime = (value: string | undefined, fallback: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? "") ? value! : fallback;

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function supportHoursConfig(settings: AppSettings) {
  return {
    enabled: settings.support_hours_enabled ?? DEFAULT_SUPPORT_HOURS.enabled,
    start: validTime(settings.support_hours_start, DEFAULT_SUPPORT_HOURS.start),
    end: validTime(settings.support_hours_end, DEFAULT_SUPPORT_HOURS.end),
    timezone: settings.support_hours_timezone || DEFAULT_SUPPORT_HOURS.timezone,
    weekdaysOnly: settings.support_weekdays_only ?? DEFAULT_SUPPORT_HOURS.weekdaysOnly,
  };
}

export function getSupportAvailability(settings: AppSettings, at = new Date()): SupportAvailability {
  const config = supportHoursConfig(settings);
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  const current = minutes(currentTime);
  const start = minutes(config.start);
  const end = minutes(config.end);
  // 자정을 넘는 운영(예: 22:00~02:00)의 새벽 시간은 전날 근무로 본다
  const shiftDay = start > end && current < end ? new Date(at.getTime() - 24 * 60 * 60 * 1000) : at;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: config.timezone, weekday: "short" }).format(shiftDay);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const inHours = start === end || (
    start < end ? current >= start && current < end : current >= start || current < end
  );
  // 시간 제한을 끄면 24시간·주말 모두 접수. 켜면 설정 시간 + (평일만 옵션이면) 평일만
  const isOpen = !config.enabled || (inHours && !(config.weekdaysOnly && isWeekend));
  const label = config.enabled ? `${config.weekdaysOnly ? "평일 " : ""}${config.start}~${config.end}` : "24시간";

  return {
    ...config,
    isOpen,
    currentTime,
    label,
    closedMessage: `현재는 문의 가능 시간이 아닙니다. 문의 가능 시간은 ${label}입니다.`,
  };
}
