import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { openDispute } from "@/lib/campaign-workflow";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorizeApi("admin", "creator", "advertiser");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  const input = (await req.json().catch(() => ({}))) as { reason?: string };
  const result = tx((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === params.id);
    if (!participation) return { ok: false as const, status: 404, error: "참여 기록을 찾을 수 없습니다." };
    return openDispute(db, user, participation, input.reason ?? "");
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
