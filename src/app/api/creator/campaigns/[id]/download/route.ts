import { NextRequest, NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { markVideoDownloaded } from "@/lib/distribution";

/**
 * 배포 참여자가 분배받은 영상을 다운로드(퍼가기) 했음을 기록한다.
 * body: { creator_id, participation_id }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { creator_id, participation_id } = body as {
    creator_id?: string;
    participation_id?: string;
  };
  if (!creator_id) {
    return NextResponse.json({ error: "creator_id 필요" }, { status: 400 });
  }

  const result = tx<{ status: number; body: unknown }>((db) => {
    // participation_id 우선, 없으면 campaign+creator+deploy로 조회
    let pid = participation_id;
    if (!pid) {
      const p = (db.campaign_participations ?? []).find(
        (x) =>
          x.campaign_id === params.id &&
          x.creator_id === creator_id &&
          (x.participation_type ?? "deploy") === "deploy"
      );
      pid = p?.id;
    }
    if (!pid) return { status: 404, body: { error: "참여 기록 없음" } };

    const v = markVideoDownloaded(db, pid);
    if (!v) return { status: 404, body: { error: "분배된 영상이 없습니다" } };
    return { status: 200, body: v };
  });

  return NextResponse.json(result.body, { status: result.status });
}
