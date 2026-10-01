import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, tx } from "@/lib/db";
import { genId } from "@/lib/crypto";
import {
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_TTL_MS,
  generateEmailCode,
  hashEmailCode,
  normalizeEmail,
  sendVerificationEmail,
} from "@/lib/email-verification";

import { clientIp, formatWait, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "올바른 이메일을 입력하세요." }, { status: 400 });
    const email = normalizeEmail(parsed.data.email);
    // 발송 횟수 제한: 같은 IP 10분 5회 · 하루 20회, 서비스 전체 1시간 300회 (메일 발송 한도 소진 방지)
    const ip = clientIp();
    const wait =
      rateLimit(`email-send-ip10m:${ip}`, 5, 10 * 60 * 1000, false) ||
      rateLimit(`email-send-ipday:${ip}`, 20, 24 * 60 * 60 * 1000, false) ||
      rateLimit("email-send-global", 300, 60 * 60 * 1000, false);
    if (wait > 0) {
      return NextResponse.json({ error: `인증번호 요청이 너무 많습니다. ${formatWait(wait)} 후 다시 시도하세요.` }, { status: 429 });
    }
    const db = getDb();
    if (db.profiles.some((profile) => normalizeEmail(profile.email) === email)) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }
    const latest = [...db.email_verifications]
      .filter((item) => item.email === email)
      .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
    if (latest && Date.now() - Date.parse(latest.requested_at) < EMAIL_CODE_COOLDOWN_MS) {
      return NextResponse.json({ error: "인증번호는 1분 후 다시 요청할 수 있습니다." }, { status: 429 });
    }
    const senderEmail = (db.settings.verification_sender_email || "").trim();
    if (!senderEmail) {
      return NextResponse.json({ error: "회원인증 발신 이메일이 아직 설정되지 않았습니다. 관리자에게 문의하세요." }, { status: 503 });
    }

    rateLimit(`email-send-ip10m:${ip}`, 5, 10 * 60 * 1000);
    rateLimit(`email-send-ipday:${ip}`, 20, 24 * 60 * 60 * 1000);
    rateLimit("email-send-global", 300, 60 * 60 * 1000);
    const id = genId();
    const code = generateEmailCode();
    await sendVerificationEmail({ to: email, senderEmail, code, idempotencyKey: `signup-${id}` });
    tx((database) => {
      database.email_verifications.push({
        id,
        email,
        code_hash: hashEmailCode(email, code),
        expires_at: new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString(),
        verified_at: null,
        consumed_at: null,
        attempts: 0,
        requested_at: new Date().toISOString(),
      });
      database.email_verifications = database.email_verifications
        .filter((item) => Date.now() - Date.parse(item.requested_at) < 24 * 60 * 60 * 1000)
        .slice(-1000);
    });
    return NextResponse.json({ ok: true, message: "인증번호를 이메일로 전송했습니다." });
  } catch (error) {
    console.error("email verification send failed", error);
    // 메일 발송 업체 오류 원문(키·계정 정보 포함 가능)은 서버 로그에만 남긴다.
    return NextResponse.json({ error: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도하세요." }, { status: 500 });
  }
}
