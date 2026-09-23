import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { genId } from "@/lib/crypto";
import { tx } from "@/lib/db";
import { audit } from "@/lib/services";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "creator") return NextResponse.json({ error: "크리에이터 권한이 필요합니다." }, { status: 403 });

  const result = tx<{ status: number; body: unknown }>((db) => {
    if (!db.ad_campaigns.some((item) => item.id === params.id)) {
      return { status: 404, body: { error: "캠페인을 찾을 수 없습니다." } };
    }
    if (!db.campaign_favorites) db.campaign_favorites = [];
    const index = db.campaign_favorites.findIndex((item) => item.campaign_id === params.id && item.creator_id === user.id);
    const favorite = index < 0;
    if (favorite) {
      db.campaign_favorites.push({ id: genId(), campaign_id: params.id, creator_id: user.id, created_at: new Date().toISOString() });
    } else {
      db.campaign_favorites.splice(index, 1);
    }
    audit(db, { actorId: user.id, action: favorite ? "favorite_campaign" : "unfavorite_campaign", targetTable: "ad_campaigns", targetId: params.id });
    return { status: 200, body: { favorite } };
  });
  return NextResponse.json(result.body, { status: result.status });
}
