import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { addWalletTx } from "@/lib/services";
import { syncCampaignVideos, markVideoDistributed } from "@/lib/distribution";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const { decision, reason } = await req.json(); // decision: "approve" | "reject"

  if (!decision) {
    return NextResponse.json({ error: "decision 필요" }, { status: 400 });
  }

  const p = (db.campaign_participations ?? []).find((x) => x.id === params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  const campaign = db.ad_campaigns.find((c) => c.id === p.campaign_id);

  if (p.status === "applied") {
    // 선발 심사: 승인 → accepted, 반려 → 유형에 따른 rejected
    if (decision === "approve") {
      p.status = "accepted";
    } else {
      p.status = p.participation_type === "video_production" ? "video_rejected" : "deploy_rejected";
      p.rejection_reason = reason || "선발되지 않았습니다.";
    }
  } else if (p.status === "video_submitted") {
    if (decision === "approve") {
      p.status = "completed";
      // 제작·승인된 영상을 배포 풀(campaign_videos)에 추가 → 배포 캠페인에서 분배됨
      if (campaign) syncCampaignVideos(db, campaign);
      // 영상제작 참여자 수익 지급 (total_cost의 70% / 영상제작 건수)
      if (campaign) {
        const reward = Math.round(
          (campaign.total_cost * 0.7) / Math.max(1, campaign.video_production_count ?? 1)
        );
        addWalletTx(db, {
          userId: p.creator_id,
          type: "campaign_reward",
          amount: reward,
          status: "available",
          relatedTable: "ad_campaigns",
          relatedId: p.campaign_id,
          memo: `캠페인 완료 수익: ${campaign.title}`,
        });
      }
    } else {
      p.status = "video_rejected";
      p.rejection_reason = reason || "반려 처리되었습니다.";
    }
  } else if (p.status === "deploy_submitted") {
    if (decision === "approve") {
      p.status = "completed";
      // 분배받은 영상을 배포완료 처리
      markVideoDistributed(db, p.id);
      // 배포 참여자 수익 지급 (total_cost의 70% / 배포 건수)
      if (campaign) {
        const reward = Math.round(
          (campaign.total_cost * 0.7) / Math.max(1, campaign.distribution_count)
        );
        addWalletTx(db, {
          userId: p.creator_id,
          type: "campaign_reward",
          amount: reward,
          status: "available",
          relatedTable: "ad_campaigns",
          relatedId: p.campaign_id,
          memo: `캠페인 완료 수익: ${campaign.title}`,
        });
      }
    } else {
      p.status = "deploy_rejected";
      p.rejection_reason = reason || "배포가 반려되었습니다.";
    }
  } else {
    return NextResponse.json(
      { error: `현재 상태(${p.status})에서는 처리할 수 없습니다.` },
      { status: 400 }
    );
  }

  p.updated_at = new Date().toISOString();
  saveDb(db);
  return NextResponse.json(p);
}
