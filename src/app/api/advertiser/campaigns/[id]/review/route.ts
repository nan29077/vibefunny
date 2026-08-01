import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addWalletTx } from "@/lib/services";
import { creatorDeployPayout } from "@/lib/actions/campaign-actions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  // 권한: advertiser 또는 admin만 허용
  if (user.role !== "advertiser" && user.role !== "admin") {
    return NextResponse.json({ error: "광고주 또는 관리자 권한이 필요합니다" }, { status: 403 });
  }

  const db = getDb();
  const { creator_id, type, action, reason } = await req.json();
  // type: "video" | "deploy", action: "approve" | "reject"

  if (!creator_id || !type || !action) {
    return NextResponse.json({ error: "creator_id, type, action 필요" }, { status: 400 });
  }

  // 캠페인 소유권 확인 (advertiser인 경우)
  const campaign = db.ad_campaigns.find((c) => c.id === params.id);
  if (!campaign) {
    return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  }
  if (user.role === "advertiser" && campaign.advertiser_id !== user.id) {
    return NextResponse.json({ error: "본인 캠페인만 심사할 수 있습니다" }, { status: 403 });
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
      // 중복 지급 방지: 이미 completed 상태면 return
      if (p.status === "completed") {
        return NextResponse.json({ error: "이미 완료 처리된 참여입니다" }, { status: 400 });
      }
      p.status = "completed";
      // campaign-actions.ts 기준: 정책 단가 기준 배포 크리에이터 지급
      const reward = creatorDeployPayout(db, campaign.platforms);
      addWalletTx(db, {
        userId: creator_id,
        type: "campaign_reward",
        amount: reward,
        status: "available",
        relatedTable: "ad_campaigns",
        relatedId: params.id,
        memo: `캠페인 완료 수익: ${campaign.title}`,
      });
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
