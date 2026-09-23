import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { resolveDispute } from "@/lib/campaign-workflow";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorizeApi("admin");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = auth.user;
  const input = (await req.json().catch(() => ({}))) as { decision?: "restore" | "complete" | "cancel"; memo?: string };
  if (!input.decision || !["restore", "complete", "cancel"].includes(input.decision)) {
    return NextResponse.json({ error: "처리 결정을 확인하세요." }, { status: 400 });
  }
  const decision = input.decision;
  const result = tx((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === params.id);
    if (!participation) return { ok: false as const, status: 404, error: "처리할 분쟁을 찾을 수 없습니다." };
    return resolveDispute(db, admin, participation, decision, input.memo);
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
