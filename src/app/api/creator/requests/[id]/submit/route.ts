import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getCurrentUser } from "@/lib/auth";
import { tx } from "@/lib/db";
import { notifyUser } from "@/lib/services";

function isHttpUrl(value: string): boolean {
  if (/^\/api\/files\/[0-9a-f-]{36}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "creator") return NextResponse.json({ error: "크리에이터 권한이 필요합니다." }, { status: 403 });

  const input = (await req.json().catch(() => ({}))) as { video_url?: string; message?: string };
  const videoUrl = input.video_url?.trim() ?? "";
  if (!isHttpUrl(videoUrl)) return NextResponse.json({ error: "유효한 http(s) 영상 URL이 필요합니다." }, { status: 400 });

  const result = tx<{ status: number; body: unknown }>((db) => {
    const request = db.custom_video_requests.find((item) => item.id === params.id);
    if (!request) return { status: 404, body: { error: "제작 의뢰를 찾을 수 없습니다." } };
    if (!request.assigned_creator_id || request.assigned_creator_id !== user.id) {
      return { status: 403, body: { error: "본인에게 배정된 제작 의뢰만 제출할 수 있습니다." } };
    }
    if (!["in_progress", "revision_requested"].includes(request.status)) {
      return { status: 409, body: { error: "진행 중이거나 수정 요청된 의뢰만 제출할 수 있습니다." } };
    }

    request.submitted_video_url = videoUrl;
    request.status = "submitted";
    request.updated_at = new Date().toISOString();
    db.custom_video_deliveries.push({
      id: nanoid(), request_id: request.id, creator_id: user.id, video_url: videoUrl,
      message: input.message?.trim().slice(0, 3000) || null, status: "submitted",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    notifyUser(db, { recipientId: request.buyer_id, title: "제작 의뢰 작업물이 제출되었습니다", message: request.title, link: "/creator/requests" });
    return { status: 200, body: { ok: true } };
  });
  return NextResponse.json(result.body, { status: result.status });
}
