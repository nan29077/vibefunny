import { NextRequest, NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { nanoid } from "nanoid";
import { hasVideoPool, isDistributionUnlocked, allocateVideoForParticipation } from "@/lib/distribution";
import type { CampaignParticipation } from "@/lib/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { creator_id, participation_type = "deploy" } = body as {
    creator_id: string;
    participation_type?: "deploy" | "video_production";
  };

  if (!creator_id) {
    return NextResponse.json({ error: "creator_id 필요" }, { status: 400 });
  }

  // tx() 내부에서 read-modify-write를 한 번에 수행 → 동시 신청 시 같은 영상이
  // 두 명에게 분배되지 않도록 원자적으로 처리한다.
  const result = tx<{ status: number; body: unknown }>((db) => {
    const campaign = db.ad_campaigns.find((c) => c.id === params.id);
    if (!campaign) {
      return { status: 404, body: { error: "캠페인을 찾을 수 없습니다" } };
    }

    // 같은 campaign_id + creator_id + participation_type 조합 중복 체크
    const existing = (db.campaign_participations ?? []).find(
      (p) =>
        p.campaign_id === params.id &&
        p.creator_id === creator_id &&
        (p.participation_type ?? "deploy") === participation_type
    );
    if (existing) {
      return { status: 400, body: { error: "이미 해당 유형으로 참여중입니다" } };
    }

    // 참여 인원 제한 체크 (유형 구분 없이 전체 합산)
    if (campaign.participation_limit) {
      const currentCount = (db.campaign_participations ?? []).filter(
        (p) => p.campaign_id === params.id
      ).length;
      if (currentCount >= campaign.participation_limit) {
        return { status: 400, body: { error: "참여 인원이 마감되었습니다" } };
      }
    }

    const isDeployPool = participation_type === "deploy" && hasVideoPool(campaign);

    // 배포(풀 모델)일 때: 순차 게이트 + 소진 여부를 먼저 확인
    if (isDeployPool) {
      if (!isDistributionUnlocked(db, campaign)) {
        return {
          status: 400,
          body: { error: "아직 영상 제작·승인이 완료되지 않아 배포를 신청할 수 없습니다." },
        };
      }
    }

    const pid = nanoid();
    // 풀 기반 배포는 신청과 동시에 영상이 분배되므로 바로 accepted 상태로 둔다.
    const participation: CampaignParticipation = {
      id: pid,
      campaign_id: params.id,
      creator_id: creator_id,
      status: isDeployPool ? "accepted" : "applied",
      participation_type: participation_type,
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!db.campaign_participations) db.campaign_participations = [];

    if (isDeployPool) {
      // 영상 1개를 원자적으로 배타 분배
      const alloc = allocateVideoForParticipation(db, campaign, creator_id, pid);
      if (!alloc.ok) {
        const msg =
          alloc.reason === "exhausted"
            ? "배포 가능한 영상이 모두 소진되었습니다."
            : alloc.reason === "locked"
            ? "아직 영상 제작·승인이 완료되지 않아 배포를 신청할 수 없습니다."
            : "배포 영상 분배에 실패했습니다.";
        // 참여를 추가하지 않고 중단 (tx 변경분은 분배 실패 영상이 없으므로 안전)
        return { status: 400, body: { error: msg } };
      }
      db.campaign_participations.push(participation);
      return {
        status: 200,
        body: { ...participation, assigned_video: alloc.video },
      };
    }

    db.campaign_participations.push(participation);
    return { status: 200, body: participation };
  });

  return NextResponse.json(result.body, { status: result.status });
}
