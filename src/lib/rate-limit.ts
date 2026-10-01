import { headers } from "next/headers";

// ===========================================================================
// 간단한 메모리 기반 횟수 제한 (단일 서버 기준)
// - 로그인 무차별 대입, 인증메일 대량 발송 차단용
// - 서버를 여러 대로 늘리면 Redis 등 공유 저장소로 옮겨야 한다.
// ===========================================================================

type Bucket = { hits: number[] };
const store: Map<string, Bucket> = ((globalThis as unknown as { __vfRateLimit?: Map<string, Bucket> }).__vfRateLimit ??= new Map());

function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (bucket.hits.length && bucket.hits[0] <= cutoff) bucket.hits.shift();
}

/** 남은 대기 시간(초). 0 이면 허용. 허용될 때만 이번 시도를 기록한다(consume=true). */
export function rateLimit(key: string, limit: number, windowMs: number, consume = true): number {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.hits.length >= limit) {
    return Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000));
  }
  if (consume) bucket.hits.push(now);
  // 메모리 누수 방지: 가끔 오래된 키 정리
  if (store.size > 20_000) {
    store.forEach((value, k) => {
      prune(value, windowMs, now);
      if (!value.hits.length) store.delete(k);
    });
  }
  return 0;
}

/** 실패 기록만 남기는 용도 (로그인 실패 횟수) */
export function recordHit(key: string): void {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }
  bucket.hits.push(Date.now());
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * 접속자 IP. X-Forwarded-For 의 왼쪽 값은 클라이언트가 위조할 수 있으므로,
 * 신뢰하는 프록시(로드밸런서) 수(TRUSTED_PROXY_HOPS, 기본 1)만큼 오른쪽에서 고른다.
 */
export function clientIp(): string {
  try {
    const h = headers();
    const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS || 1)));
    const list = (h.get("x-forwarded-for") || "").split(",").map((v) => v.trim()).filter(Boolean);
    if (list.length) return list[Math.max(0, list.length - hops)];
    return h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

export function formatWait(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}분`;
  return `${seconds}초`;
}
