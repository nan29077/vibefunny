import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tx } from "@/lib/db";
import { addPointTxOnce, audit, notifyUser } from "@/lib/services";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "advertiser" && user.role !== "admin") return NextResponse.json({ error: "취소 권한이 없습니다." }, { status: 403 });
  const result = tx<{ status: number; body: unknown }>((db) => {
    const campaign = db.ad_campaigns.find((item) => item.id === params.id);
    if (!campaign) return { status: 404, body: { error: "캠페인을 찾을 수 없습니다." } };
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) return { status: 403, body: { error: "본인 캠페인만 취소할 수 있습니다." } };
    if (["completed", "refunded"].includes(campaign.status)) return { status: 409, body: { error: "완료 또는 환불된 캠페인은 취소할 수 없습니다." } };
    const participations = (db.campaign_participations ?? []).filter((item) => item.campaign_id === campaign.id);
    if (participations.some((item) => ["video_submitted", "deploy_submitted", "completed", "disputed"].includes(item.status))) {
      return { status: 409, body: { error: "제출 또는 완료된 작업이 있어 관리자 분쟁 처리 후 취소해야 합니다." } };
    }
    campaign.status = "refunded";
    campaign.updated_at = new Date().toISOString();
    for (const participation of participations) {
      participation.status = "cancelled"; participation.updated_at = campaign.updated_at;
      notifyUser(db, { recipientId: participation.creator_id, title: "캠페인이 취소되었습니다", message: campaign.title, link: "/creator/campaigns" });
    }
    addPointTxOnce(db, { advertiserId: campaign.advertiser_id, type: "refund", amount: campaign.point_spent, campaignId: campaign.id, memo: `캠페인 취소 환불: ${campaign.title}` });
    // 실행사 pending 수수료 취소: 캠페인 취소 시 미승인 수수료 지갑 거래를 cancelled로 처리
    db.wallet_transactions
      .filter((t) => t.related_id === campaign.id && t.type === "advertiser_commission" && t.status === "pending")
      .forEach((t) => { t.status = "cancelled"; t.updated_at = campaign.updated_at; });
    audit(db, { actorId: user.id, action: "cancel_and_refund_campaign", targetTable: "ad_campaigns", targetId: campaign.id });
    return { status: 200, body: campaign };
  });
  return NextResponse.json(result.body, { status: result.status });
}
