import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    // 크리에이터는 항상 추천인(멘토) 코드가 필요하다
    referralRequired: true,
    emailSenderConfigured: Boolean(db.settings.verification_sender_email && process.env.RESEND_API_KEY),
  });
}
