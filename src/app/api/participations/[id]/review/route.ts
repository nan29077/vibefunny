import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { reviewParticipation } from "@/lib/campaign-workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authorizeApi("admin", "advertiser");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  const input = (await req.json().catch(() => ({}))) as { decision?: string; reason?: string; expected_status?: string };
  if (input.decision !== "approve" && input.decision !== "reject") {
    return NextResponse.json({ error: "decision은 approve 또는 reject여야 합니다." }, { status: 400 });
  }
  const decision = input.decision;

  const result = tx((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === params.id);
    if (!participation) return { ok: false as const, status: 404, error: "참여 기록을 찾을 수 없습니다." };
    if (input.expected_status && participation.status !== input.expected_status) {
      return { ok: false as const, status: 409, error: "그 사이 참여 상태가 바뀌었습니다. 화면을 새로 고친 뒤 다시 처리해 주세요." };
    }
    return reviewParticipation(db, user, participation, decision, input.reason);
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
