import { NextRequest, NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/services";

export async function POST(req: NextRequest) {
  // 인증: admin 역할 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  const { video_id, action } = (await req.json()) as {
    video_id: string;
    action: "approve" | "reject";
  };
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "action 값이 올바르지 않습니다." }, { status: 400 });
  const video = tx((db) => {
    const item = db.videos?.find((entry) => entry.id === video_id);
    if (!item) return null;
    if (action === "approve") { item.vibeporter_approved = true; item.vibeporter_approved_at = new Date().toISOString(); }
    else { item.vibeporter_approved = false; item.vibeporter_enabled = false; item.vibeporter_approved_at = undefined; }
    item.updated_at = new Date().toISOString();
    audit(db, { actorId: user.id, action: `vibeporter_${action}`, targetTable: "videos", targetId: item.id });
    return item;
  });
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
  revalidatePath("/admin/vibeporter");
  revalidatePath("/admin/videos");
  return NextResponse.json(video);
}
