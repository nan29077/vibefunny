import { NextResponse } from "next/server";
import { z } from "zod";
import { tx } from "@/lib/db";
import { EMAIL_CODE_MAX_ATTEMPTS, emailCodeMatches, normalizeEmail } from "@/lib/email-verification";

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "이메일과 6자리 인증번호를 확인하세요." }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);
  const result = tx<{ ok: boolean; error?: string }>((db) => {
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
    return { ok: true };
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
