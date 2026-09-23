import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getCurrentUser } from "@/lib/auth";
import { getDb, tx } from "@/lib/db";
import { audit, notifyUser } from "@/lib/services";
import { campaignLinkFor, canCreatorViewCampaign } from "@/lib/campaign-workflow";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = getDb();
  const campaign = db.ad_campaigns.find((item) => item.id === params.id);
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
  if (user.role === "advertiser" && campaign.advertiser_id !== user.id) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  // 크리에이터: 공개 캠페인 또는 본인 참여 캠페인만
  if (user.role === "creator" && !canCreatorViewCampaign(db, user.id, campaign)) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  return NextResponse.json((db.campaign_comments ?? []).filter((item) => item.campaign_id === params.id));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const input = (await req.json().catch(() => ({}))) as { content?: string };
  const content = input.content?.trim() ?? "";
  if (!content || content.length > 3000) return NextResponse.json({ error: "댓글은 1~3000자여야 합니다." }, { status: 400 });
  const result = tx<{ status: number; body: unknown }>((db) => {
    const campaign = db.ad_campaigns.find((item) => item.id === params.id);
    if (!campaign) return { status: 404, body: { error: "캠페인을 찾을 수 없습니다." } };
    const creatorParticipates = (db.campaign_participations ?? []).some((item) => item.campaign_id === campaign.id && item.creator_id === user.id);
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) return { status: 403, body: { error: "접근 권한이 없습니다." } };
    if (user.role === "creator" && !creatorParticipates && !["published", "recruiting", "in_progress", "submitted"].includes(campaign.status)) return { status: 403, body: { error: "댓글 작성 권한이 없습니다." } };
    const comment = { id: nanoid(), campaign_id: campaign.id, author_id: user.id, author_name: user.name, author_role: user.role, content, created_at: new Date().toISOString() };
    if (!db.campaign_comments) db.campaign_comments = [];
    db.campaign_comments.push(comment);
    audit(db, { actorId: user.id, action: "comment_campaign", targetTable: "ad_campaigns", targetId: campaign.id });
    // 댓글 알림: 작성자가 아닌 경우 캠페인 광고주에게
    const preview = `${campaign.title} · ${content.slice(0, 80)}`;
    if (user.id !== campaign.advertiser_id && db.profiles.some((item) => item.id === campaign.advertiser_id)) {
      notifyUser(db, { recipientId: campaign.advertiser_id, title: "캠페인에 새 댓글이 달렸습니다", message: preview, link: campaignLinkFor(db, campaign.advertiser_id, campaign.id), category: "message" });
    }
    return { status: 200, body: comment };
  });
  return NextResponse.json(result.body, { status: result.status });
}
