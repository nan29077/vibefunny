import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tx } from "@/lib/db";
import { markVideoDownloaded } from "@/lib/distribution";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "creator") return NextResponse.json({ error: "크리에이터 권한이 필요합니다." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { participation_id?: string };
  const result = tx<{ status: number; body: unknown }>((db) => {
    const participation = body.participation_id
      ? (db.campaign_participations ?? []).find((item) => item.id === body.participation_id)
      : (db.campaign_participations ?? []).find(
          (item) => item.campaign_id === params.id && item.creator_id === user.id && (item.participation_type ?? "deploy") === "deploy"
        );

    if (!participation) return { status: 404, body: { error: "참여 기록을 찾을 수 없습니다." } };
    if (
      participation.creator_id !== user.id ||
      participation.campaign_id !== params.id ||
      (participation.participation_type ?? "deploy") !== "deploy"
    ) {
      return { status: 403, body: { error: "본인 캠페인의 배포 참여 건만 다운로드할 수 있습니다." } };
    }
    if (!["accepted", "deploy_rejected", "deploy_submitted"].includes(participation.status)) {
      return { status: 409, body: { error: "현재 상태에서는 영상을 다운로드할 수 없습니다." } };
    }

    const video = markVideoDownloaded(db, participation.id);
    if (!video) return { status: 404, body: { error: "배정된 영상을 찾을 수 없습니다." } };
    return { status: 200, body: video };
  });

  return NextResponse.json(result.body, { status: result.status });
}
