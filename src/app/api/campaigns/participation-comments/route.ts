import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { ParticipationComment } from "@/lib/schema";

export const dynamic = "force-dynamic";

// GET /api/campaigns/participation-comments?participation_id=X
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const participationId = searchParams.get("participation_id");

  if (!participationId) {
    return NextResponse.json({ error: "participation_id 필요" }, { status: 400 });
  }

  const comments = (db.participation_comments ?? []).filter(
    (c) => c.participation_id === participationId
  );
  return NextResponse.json(comments);
}

// POST /api/campaigns/participation-comments
// Body: { participation_id, content }
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  const body = await req.json().catch(() => ({}));
  const { participation_id, content } = body as { participation_id?: string; content?: string };

  if (!participation_id || !content?.trim()) {
    return NextResponse.json({ error: "participation_id, content 필요" }, { status: 400 });
  }

  const participation = (db.campaign_participations ?? []).find(
    (p) => p.id === participation_id
  );
  if (!participation) {
    return NextResponse.json({ error: "참여 기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const comment: ParticipationComment = {
    id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participation_id,
    campaign_id: participation.campaign_id,
    author_id: user.id,
    author_name: user.name,
    author_role: user.role as "advertiser" | "creator" | "admin",
    content: content.trim(),
    created_at: new Date().toISOString(),
  };

  if (!db.participation_comments) db.participation_comments = [];
  db.participation_comments.push(comment);
  saveDb(db);

  return NextResponse.json(comment);
}
