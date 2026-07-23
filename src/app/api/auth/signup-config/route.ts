import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    referralRequired: db.settings.referral_system_enabled,
    emailSenderConfigured: Boolean(db.settings.verification_sender_email && process.env.RESEND_API_KEY),
  });
}
