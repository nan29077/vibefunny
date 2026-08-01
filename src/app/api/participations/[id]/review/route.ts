import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addWalletTx } from "@/lib/services";
import { syncCampaignVideos, markVideoDistributed } from "@/lib/distribution";
import { creatorDeployPayout, creatorVideoPayout } from "@/lib/actions/campaign-actions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  // 권한: admin만 허용
  if (user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

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
      // campaign-actions.ts 기준: video_submitted → video_approved (지급 없음, 다음 단계에서 지급)
      p.status = "video_approved";
      // 제작·승인된 영상을 배포 풀(campaign_videos)에 추가
      if (campaign) syncCampaignVideos(db, campaign);
    } else {
      p.status = "video_rejected";
      p.rejection_reason = reason || "반려 처리되었습니다.";
    }
  } else if (p.status === "video_approved") {
    if (decision === "approve") {
      // campaign-actions.ts 기준: 정책 단가 기준 영상제작 크리에이터 지급
      p.status = "completed";
      if (campaign) {
        const reward = creatorVideoPayout(db, campaign.video_duration_tier);
        addWalletTx(db, {
          userId: p.creator_id,
          type: "campaign_reward",
          amount: reward,
          status: "available",
          relatedTable: "campaign_participations",
          relatedId: p.id,
          memo: `영상제작 완료 수익: ${campaign.title}`,
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
      // campaign-actions.ts 기준: 정책 단가 기준 배포 크리에이터 지급
      if (campaign) {
        const reward = creatorDeployPayout(db, campaign.platforms);
        addWalletTx(db, {
          userId: p.creator_id,
          type: "campaign_reward",
          amount: reward,
          status: "available",
          relatedTable: "campaign_participations",
          relatedId: p.id,
          memo: `배포 완료 수익: ${campaign.title}`,
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
