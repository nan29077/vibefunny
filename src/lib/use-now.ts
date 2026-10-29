"use client";

import { useEffect, useState } from "react";

/** 브라우저에서만 현재 시각을 준다 (서버 렌더링 중에는 null) — D-day 계산의 하이드레이션 불일치 방지 */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
