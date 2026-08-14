import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tx } from "@/lib/db";
import { syncCampaignVideos, markVideoDistributed } from "@/lib/distribution";
import { creatorDeployPayout, creatorVideoPayout } from "@/lib/queries";
import { addWalletTxOnce, audit, notifyUser } from "@/lib/services";

type Result = { status: number; body: unknown };

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "advertiser") {
    return NextResponse.json({ error: "승인 권한이 없습니다." }, { status: 403 });
  }

  const input = (await req.json().catch(() => ({}))) as { decision?: string; reason?: string };
  if (input.decision !== "approve" && input.decision !== "reject") {
    return NextResponse.json({ error: "decision은 approve 또는 reject여야 합니다." }, { status: 400 });
  }

  const result = tx<Result>((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === params.id);
    if (!participation) return { status: 404, body: { error: "참여 기록을 찾을 수 없습니다." } };

    const campaign = db.ad_campaigns.find((item) => item.id === participation.campaign_id);
    if (!campaign) return { status: 404, body: { error: "캠페인을 찾을 수 없습니다." } };
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) {
      return { status: 403, body: { error: "본인 캠페인만 승인할 수 있습니다." } };
    }

    const reject = (status: "video_rejected" | "deploy_rejected") => {
      participation.status = status;
      participation.rejection_reason = input.reason?.trim() || "반려 처리되었습니다.";
    };

    if (participation.status === "applied") {
      if (input.decision === "approve") participation.status = "accepted";
      else {
        // 선발 단계 반려: application_rejected (작업물 제출 불가, video_rejected/deploy_rejected와 분리)
        participation.status = "application_rejected";
        participation.rejection_reason = input.reason?.trim() || "선발되지 않았습니다.";
      }
    } else if (participation.status === "video_submitted") {
      if (input.decision === "reject") reject("video_rejected");
      else {
        participation.status = "completed";
        participation.rejection_reason = undefined;
        syncCampaignVideos(db, campaign);
        addWalletTxOnce(db, {
          userId: participation.creator_id,
          type: "campaign_reward",
          amount: creatorVideoPayout(db, campaign.video_duration_tier),
          status: "available",
          relatedTable: "campaign_participations",
          relatedId: participation.id,
          memo: `영상제작 완료 수익: ${campaign.title}`,
        });
      }
    } else if (participation.status === "video_approved") {
      // 기존 데이터와의 호환을 위한 레거시 승인 단계
      if (input.decision === "reject") reject("video_rejected");
      else {
        participation.status = "completed";
        addWalletTxOnce(db, {
          userId: participation.creator_id,
          type: "campaign_reward",
          amount: creatorVideoPayout(db, campaign.video_duration_tier),
          status: "available",
          relatedTable: "campaign_participations",
          relatedId: participation.id,
          memo: `영상제작 완료 수익: ${campaign.title}`,
        });
      }
    } else if (participation.status === "deploy_submitted") {
      if (input.decision === "reject") reject("deploy_rejected");
      else {
        participation.status = "completed";
        participation.rejection_reason = undefined;
        markVideoDistributed(db, participation.id);
        addWalletTxOnce(db, {
          userId: participation.creator_id,
          type: "campaign_reward",
          amount: creatorDeployPayout(db, campaign.platforms),
          status: "available",
          relatedTable: "campaign_participations",
          relatedId: participation.id,
          memo: `배포 완료 수익: ${campaign.title}`,
        });
      }
    } else {
      return { status: 409, body: { error: `현재 상태(${participation.status})에서는 처리할 수 없습니다.` } };
    }

    participation.updated_at = new Date().toISOString();
    notifyUser(db, {
      recipientId: participation.creator_id,
      title: input.decision === "approve" ? "캠페인 작업이 승인되었습니다" : "캠페인 작업이 반려되었습니다",
      message: `${campaign.title} · 현재 상태: ${participation.status}${participation.rejection_reason ? ` · ${participation.rejection_reason}` : ""}`,
      link: "/creator/campaigns",
    });
    audit(db, {
      actorId: user.id,
      action: `participation_${input.decision}`,
      targetTable: "campaign_participations",
      targetId: participation.id,
    });
    return { status: 200, body: participation };
  });

  return NextResponse.json(result.body, { status: result.status });
}
