import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

  const db = getDb();
  const { id } = params;
  const body = await req.json();
  const { video_url, message } = body;
  // creator_id는 세션 user.id 사용 (body 값 무시)
  const creator_id = user.id;

  const request = db.custom_video_requests.find((r) => r.id === id);
  if (!request) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다" }, { status: 404 });
  }

  // 소유권 확인: assigned_creator_id가 이미 다른 크리에이터로 지정되어 있으면 거부
  if (request.assigned_creator_id && request.assigned_creator_id !== user.id) {
    return NextResponse.json({ error: "이미 다른 크리에이터에게 배정된 의뢰입니다" }, { status: 403 });
  }

  // Update submitted_video_url on the request
  request.submitted_video_url = video_url ?? null;
  request.status = "submitted";
  request.updated_at = new Date().toISOString();

  // Also create a delivery record
  const { nanoid } = await import("nanoid");
  db.custom_video_deliveries.push({
    id: nanoid(),
    request_id: id,
    creator_id,
    video_url: video_url ?? "",
    message: message ?? null,
    status: "submitted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  saveDb(db);
  return NextResponse.json({ ok: true });
}
