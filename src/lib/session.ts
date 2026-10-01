import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// ===========================================================================
// 세션 = 서명된 쿠키(HMAC). 로컬 모드 전용 Mock Auth.
// [TODO] Supabase 전환 시 supabase.auth 세션으로 대체.
//
// 토큰 형식: <userId>.<sessionVersion>.<issuedAt(base36 ms)>.<hmac-sha256-hex>
// - 서버에서 발급 시각을 검사해 7일이 지나면 무효 (쿠키 maxAge 와 별개로 서버가 만료를 강제)
// - 로그아웃·비밀번호 변경 시 회원의 session_version 을 올려 이전에 발급된 모든 토큰을 무효화
// ===========================================================================

const COOKIE_NAME = "vf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// SESSION_SECRET 환경변수 처리
// - production: 미설정 시 에러 throw
// - development: 미설정 시 경고만 출력하고 dev-secret 사용
function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다");
    }
    console.warn("[session] SESSION_SECRET 미설정 — 개발용 시크릿 사용 중 (프로덕션에서는 반드시 설정)");
    return "vibefunny-dev-secret";
  }
  return secret;
}

// 모듈 로드 시점이 아닌 "첫 사용 시점"에 시크릿을 확인한다.
// (next build 의 page-data 수집 단계에서 SESSION_SECRET 없이도 빌드가 가능하도록)
let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret === null) cachedSecret = resolveSecret();
  return cachedSecret;
}

function hmac(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function signSessionToken(userId: string, version: number, issuedAtMs: number = Date.now()): string {
  const payload = `${userId}.${Math.max(0, Math.floor(version))}.${issuedAtMs.toString(36)}`;
  return `${payload}.${hmac(payload)}`;
}

export interface SessionClaims {
  userId: string;
  version: number;
  issuedAt: number;
}

export function verifySessionToken(token: string | undefined, nowMs: number = Date.now()): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, versionText, iatText, sig] = parts;
  if (!userId || !/^\d+$/.test(versionText) || !/^[0-9a-z]+$/.test(iatText) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const expected = hmac(`${userId}.${versionText}.${iatText}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const issuedAt = parseInt(iatText, 36);
  if (!Number.isFinite(issuedAt)) return null;
  // 서버 측 만료: 발급 후 7일, 미래 시각(시계 조작) 토큰 거부
  if (nowMs - issuedAt > SESSION_MAX_AGE_SECONDS * 1000 || issuedAt - nowMs > 5 * 60 * 1000) return null;
  return { userId, version: Number(versionText), issuedAt };
}

export function setSession(userId: string, version = 0): void {
  cookies().set(COOKIE_NAME, signSessionToken(userId, version), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}

/** 서명·만료가 유효한 세션 정보 (회원의 세션 버전 비교는 auth.ts 에서 한다) */
export function getSessionClaims(): SessionClaims | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getSessionUserId(): string | null {
  return getSessionClaims()?.userId ?? null;
}
