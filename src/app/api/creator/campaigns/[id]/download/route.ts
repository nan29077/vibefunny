import { NextRequest, NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { markVideoDownloaded } from "@/lib/distribution";

/**
 * 배포 참여자가 분배받은 영상을 다운로드(퍼가기) 했음을 기록한다.
 * body: { participation_id? } — creator_id는 세션에서 가져온다
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증: 로그인 필수, creator 역할 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (user.role !== "creator") {
    return NextResponse.json({ error: "크리에이터 권한이 필요합니다" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { participation_id } = body as {
    participation_id?: string;
  };

  // creator_id는 세션 user.id 사용
  const creator_id = user.id;

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
