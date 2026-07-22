import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// ===========================================================================
// 세션 = 서명된 쿠키(HMAC). 로컬 모드 전용 Mock Auth.
// [TODO] Supabase 전환 시 supabase.auth 세션으로 대체.
// ===========================================================================

const COOKIE_NAME = "vf_session";
const SECRET = process.env.SESSION_SECRET || "vibefunny-dev-secret";

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
