import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const { id } = params;
  const body = await req.json();
  const { creator_id, video_url, message } = body;

  const request = db.custom_video_requests.find((r) => r.id === id);
  if (!request) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다" }, { status: 404 });
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
