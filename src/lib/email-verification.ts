import { createHash, randomInt, timingSafeEqual } from "crypto";

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_COOLDOWN_MS = 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function generateEmailCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashEmailCode(email: string, code: string): string {
  const secret = process.env.EMAIL_VERIFICATION_HASH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("EMAIL_VERIFICATION_HASH_SECRET 또는 SESSION_SECRET 설정이 필요합니다.");
  return createHash("sha256").update(`${normalizeEmail(email)}:${code}:${secret}`).digest("hex");
}

export function emailCodeMatches(email: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashEmailCode(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function sendVerificationEmail(params: {
  to: string;
  senderEmail: string;
  code: string;
  idempotencyKey: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("서버에 RESEND_API_KEY가 설정되지 않았습니다.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      from: `VIBEFUNNY <${params.senderEmail}>`,
      to: [params.to],
      subject: "[VIBEFUNNY] 회원가입 이메일 인증번호",
      text: `VIBEFUNNY 회원가입 인증번호는 ${params.code}입니다. 인증번호는 10분 동안 유효합니다.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;border:1px solid #f2d66d;border-radius:18px"><h1 style="font-size:22px">VIBEFUNNY 이메일 인증</h1><p>아래 인증번호를 회원가입 화면에 입력해 주세요.</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#d79a00">${params.code}</p><p style="color:#777">인증번호는 10분 동안 유효합니다.</p></div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`인증 메일 발송에 실패했습니다. (${response.status}) ${detail.slice(0, 200)}`);
  }
}
