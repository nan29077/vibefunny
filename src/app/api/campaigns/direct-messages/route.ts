import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getCurrentUser } from "@/lib/auth";
import { getDb, tx } from "@/lib/db";
import type { CampaignDirectMessage, Database, Profile } from "@/lib/schema";
import { notifyUser } from "@/lib/services";
import { campaignLinkFor } from "@/lib/campaign-workflow";

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
  const { searchParams } = new URL(req.url);
  const db = getDb();
  let participationId = searchParams.get("participation_id");
  if (!participationId) {
    const campaignId = searchParams.get("campaign_id");
    const creatorId = searchParams.get("creator_id");
    participationId = (db.campaign_participations ?? []).find(
      (item) => item.campaign_id === campaignId && item.creator_id === creatorId
    )?.id ?? null;
  }
  if (!participationId) return NextResponse.json({ error: "participation_id가 필요합니다." }, { status: 400 });
  if (!canAccess(db, user, participationId)) return NextResponse.json({ error: "대화 접근 권한이 없습니다." }, { status: 403 });
  return NextResponse.json((db.campaign_direct_messages ?? []).filter((item) => item.participation_id === participationId));
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const input = (await req.json().catch(() => ({}))) as { participation_id?: string; content?: string };
  const content = input.content?.trim() ?? "";
  if (!input.participation_id || !content || content.length > 3000) {
    return NextResponse.json({ error: "참여 건과 1~3000자의 메시지가 필요합니다." }, { status: 400 });
  }
  const result = tx<{ status: number; body: unknown }>((db) => {
    if (!canAccess(db, user, input.participation_id!)) return { status: 403, body: { error: "대화 접근 권한이 없습니다." } };
    const participation = (db.campaign_participations ?? []).find((item) => item.id === input.participation_id)!;
    const message: CampaignDirectMessage = {
      id: nanoid(), campaign_id: participation.campaign_id, participation_id: participation.id,
      creator_id: participation.creator_id, from_role: user.role, from_name: user.name,
      content, created_at: new Date().toISOString(), read: false,
    };
    if (!db.campaign_direct_messages) db.campaign_direct_messages = [];
    db.campaign_direct_messages.push(message);
    const campaign = db.ad_campaigns.find((item) => item.id === participation.campaign_id);
    // 수신자: 크리에이터 → 광고주, 광고주 → 크리에이터, 관리자 → 양쪽 모두
    const recipients =
      user.role === "creator" ? [campaign?.advertiser_id]
      : user.role === "advertiser" ? [participation.creator_id]
      : [participation.creator_id, campaign?.advertiser_id];
    for (const recipientId of recipients) {
      if (!recipientId || recipientId === user.id || !db.profiles.some((item) => item.id === recipientId)) continue;
      notifyUser(db, {
        recipientId,
        title: "새 캠페인 메시지가 도착했습니다",
        message: `${campaign?.title ?? "캠페인"} · ${content.slice(0, 100)}`,
        link: campaignLinkFor(db, recipientId, participation.campaign_id),
        category: "message",
      });
    }
    return { status: 200, body: message };
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const input = (await req.json().catch(() => ({}))) as { participation_id?: string };
  if (!input.participation_id) return NextResponse.json({ error: "participation_id가 필요합니다." }, { status: 400 });
  const result = tx<{ status: number; body: unknown }>((db) => {
    if (!canAccess(db, user, input.participation_id!)) return { status: 403, body: { error: "대화 접근 권한이 없습니다." } };
    // 관리자는 대화 열람만 하는 참관자이므로 읽음 처리를 하지 않는다 (당사자의 안 읽음 표시 보존)
    if (user.role !== "admin") {
      for (const message of db.campaign_direct_messages ?? []) {
        if (message.participation_id === input.participation_id && message.from_role !== user.role) message.read = true;
      }
    }
    return { status: 200, body: { ok: true } };
  });
  return NextResponse.json(result.body, { status: result.status });
}
