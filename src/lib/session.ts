import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// ===========================================================================
// 세션 = 서명된 쿠키(HMAC). 로컬 모드 전용 Mock Auth.
// [TODO] Supabase 전환 시 supabase.auth 세션으로 대체.
// ===========================================================================

const COOKIE_NAME = "vf_session";

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

const SECRET = resolveSecret();

function sign(userId: string): string {
  const sig = createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(userId).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? userId : null;
  } catch {
    return null;
  }
}

export function setSession(userId: string): void {
  cookies().set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}

export function getSessionUserId(): string | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verify(token);
}
