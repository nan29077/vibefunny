import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
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
