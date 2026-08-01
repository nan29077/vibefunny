import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  // 인증: admin 역할 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  const db = getDb();
  const { video_id, action } = (await req.json()) as {
    video_id: string;
    action: "approve" | "reject";
  };

  const video = db.videos?.find((v) => v.id === video_id);
  if (!video) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (action === "approve") {
    video.vibeporter_approved = true;
    video.vibeporter_approved_at = new Date().toISOString();
  } else {
    video.vibeporter_approved = false;
    video.vibeporter_enabled = false;
    video.vibeporter_approved_at = undefined;
  }
  video.updated_at = new Date().toISOString();

  saveDb(db);
  revalidatePath("/admin/vibeporter");
  revalidatePath("/admin/videos");
  return NextResponse.json(video);
}
