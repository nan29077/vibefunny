import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { addWalletTx } from "@/lib/services";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const { creator_id, type, action, reason } = await req.json();
  // type: "video" | "deploy", action: "approve" | "reject"

  if (!creator_id || !type || !action) {
    return NextResponse.json({ error: "creator_id, type, action 필요" }, { status: 400 });
  }

  const p = db.campaign_participations?.find(
    (p) => p.campaign_id === params.id && p.creator_id === creator_id
  );
  if (!p) {
    return NextResponse.json({ error: "참여 기록 없음" }, { status: 404 });
  }

  if (type === "video") {
    p.status = action === "approve" ? "video_approved" : "video_rejected";
    if (action === "reject") {
      p.rejection_reason = reason || "반려 처리되었습니다.";
    }
  } else if (type === "deploy") {
    if (action === "approve") {
      p.status = "completed";
      // 배포 승인 시 크리에이터 수익 지급 (total_cost의 70%)
      const campaign = db.ad_campaigns.find((c) => c.id === params.id);
      if (campaign) {
        const reward = Math.round(campaign.total_cost * 0.7);
        addWalletTx(db, {
          userId: creator_id,
          type: "campaign_reward",
          amount: reward,
          status: "available",
          relatedTable: "ad_campaigns",
          relatedId: params.id,
          memo: `캠페인 완료 수익: ${campaign.title}`,
        });
      }
    } else {
      p.status = "deploy_rejected";
      p.rejection_reason = reason || "배포가 반려되었습니다.";
    }
  } else {
    return NextResponse.json({ error: "type은 video 또는 deploy" }, { status: 400 });
  }

  p.updated_at = new Date().toISOString();
  saveDb(db);

  return NextResponse.json(p);
}
