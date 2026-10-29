import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { clientIp, formatWait, rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { tx } from "@/lib/db";
import { EMAIL_CODE_MAX_ATTEMPTS, EMAIL_VERIFIED_TTL_MS, EMAIL_VERIFY_COOKIE, emailCodeMatches, hashVerifyToken, normalizeEmail } from "@/lib/email-verification";

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "이메일과 6자리 인증번호를 확인하세요." }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);
  // 같은 IP 에서 인증번호 대입 시도 제한 (10분 100회 — 이메일별 5회 제한은 별도)
  const wait = rateLimit(`email-verify-ip:${clientIp()}`, 100, 10 * 60 * 1000);
  if (wait > 0) return NextResponse.json({ ok: false, error: `시도가 너무 많습니다. ${formatWait(wait)} 후 다시 시도하세요.` }, { status: 429 });
  const token = randomBytes(24).toString("base64url");
  const result = tx<{ ok: boolean; error?: string; id?: string }>((db) => {
    const item = [...db.email_verifications]
      .filter((entry) => entry.email === email && !entry.consumed_at)
      .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
    if (!item) return { ok: false, error: "먼저 인증번호를 요청하세요." };
    if (Date.parse(item.expires_at) < Date.now()) return { ok: false, error: "인증번호가 만료되었습니다. 다시 요청하세요." };
    if (item.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return { ok: false, error: "입력 횟수를 초과했습니다. 인증번호를 다시 요청하세요." };
    if (!emailCodeMatches(email, parsed.data.code, item.code_hash)) {
      item.attempts += 1;
      return { ok: false, error: "인증번호가 올바르지 않습니다." };
    }
    item.verified_at = new Date().toISOString();
    item.verify_token_hash = hashVerifyToken(token);
    return { ok: true, id: item.id };
  });
  const response = NextResponse.json({ ok: result.ok, error: result.error }, { status: result.ok ? 200 : 400 });
  if (result.ok && result.id) {
    response.cookies.set(EMAIL_VERIFY_COOKIE, `${result.id}.${token}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(EMAIL_VERIFIED_TTL_MS / 1000),
    });
  }
  return response;
}
