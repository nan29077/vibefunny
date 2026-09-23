import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { submitParticipationWork } from "@/lib/campaign-workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authorizeApi("creator");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  const input = (await req.json().catch(() => ({}))) as {
    type?: "video" | "deploy";
    video_url?: string;
    deploy_link?: string;
    note?: string;
  };
  if (input.type !== "video" && input.type !== "deploy") {
    return NextResponse.json({ error: "type은 video 또는 deploy여야 합니다." }, { status: 400 });
  }
  const workUrl = (input.type === "video" ? input.video_url : input.deploy_link)?.trim() ?? "";

  const result = tx((db) => {
    const participationType = input.type === "video" ? "video_production" : "deploy";
    const participation = (db.campaign_participations ?? []).find(
      (item) =>
        item.campaign_id === params.id &&
        item.creator_id === user.id &&
        (item.participation_type ?? "deploy") === participationType
    );
    if (!participation) return { ok: false as const, status: 404, error: "해당 유형의 참여 기록을 찾을 수 없습니다." };
    return submitParticipationWork(db, user, participation, { url: workUrl, note: input.note });
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
