import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, tx } from "@/lib/db";
import type { Database, ParticipationComment, Profile } from "@/lib/schema";

export const dynamic = "force-dynamic";

function canAccess(db: Database, user: Profile, participationId: string) {
  const participation = (db.campaign_participations ?? []).find((item) => item.id === participationId);
  if (!participation) return false;
  if (user.role === "admin" || participation.creator_id === user.id) return true;
  const campaign = db.ad_campaigns.find((item) => item.id === participation.campaign_id);
  return user.role === "advertiser" && campaign?.advertiser_id === user.id;
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const participationId = new URL(req.url).searchParams.get("participation_id");
  if (!participationId) return NextResponse.json({ error: "participation_id가 필요합니다." }, { status: 400 });
  const db = getDb();
  if (!canAccess(db, user, participationId)) return NextResponse.json({ error: "댓글 접근 권한이 없습니다." }, { status: 403 });
  return NextResponse.json((db.participation_comments ?? []).filter((item) => item.participation_id === participationId));
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const input = (await req.json().catch(() => ({}))) as { participation_id?: string; content?: string };
  const content = input.content?.trim() ?? "";
  if (!input.participation_id || !content || content.length > 3000) {
    return NextResponse.json({ error: "참여 건과 1~3000자의 댓글이 필요합니다." }, { status: 400 });
  }
  const result = tx<{ status: number; body: unknown }>((db) => {
    if (!canAccess(db, user, input.participation_id!)) return { status: 403, body: { error: "댓글 접근 권한이 없습니다." } };
    const participation = (db.campaign_participations ?? []).find((item) => item.id === input.participation_id)!;
    const comment: ParticipationComment = {
      id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      participation_id: participation.id, campaign_id: participation.campaign_id,
      author_id: user.id, author_name: user.name, author_role: user.role,
      content, created_at: new Date().toISOString(),
    };
    if (!db.participation_comments) db.participation_comments = [];
    db.participation_comments.push(comment);
    return { status: 200, body: comment };
  });
  return NextResponse.json(result.body, { status: result.status });
}
