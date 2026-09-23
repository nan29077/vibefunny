import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CreatorCampaignsUI } from "@/components/campaigns/creator-campaigns-ui";
import { creatorDeployPayout, creatorVideoPayout } from "@/lib/queries";
import { displayName } from "@/lib/schema";
import { hasVideoPool, isDistributionUnlocked, poolStats, campaignPoolVideos } from "@/lib/distribution";
import { participationCapacity } from "@/lib/campaign-eligibility";
import { campaignAcceptsType, isPastDeadline } from "@/lib/campaign-workflow";

export const dynamic = "force-dynamic";

export default function CreatorCampaignsPage() {
  const user = requireRole("creator");
  const db = getDb();

  // 노출할 캠페인 (recruiting/published/in_progress/submitted)
  const campaigns = db.ad_campaigns.filter((c) =>
    ["recruiting", "published", "in_progress", "submitted", "completed"].includes(c.status)
  );

  // 내 참여 기록
  const myParticipations = (db.campaign_participations ?? []).filter(
    (p) => p.creator_id === user.id
  );
  const favoriteCampaignIds = (db.campaign_favorites ?? [])
    .filter((item) => item.creator_id === user.id)
    .map((item) => item.campaign_id);

  // 내가 참여한 캠페인들의 댓글을 미리 로드
  const participatedIds = new Set(myParticipations.map((p) => p.campaign_id));
  const allRelevantIds = new Set([
    ...campaigns.map((c) => c.id),
    ...participatedIds,
  ]);

  const initialComments: Record<string, import("@/lib/schema").CampaignComment[]> = {};
  for (const id of allRelevantIds) {
    initialComments[id] = (db.campaign_comments ?? []).filter(
      (c) => c.campaign_id === id
    );
  }

  // 1:1 DM 메시지 (participation_id -> messages)
  const allDMs = db.campaign_direct_messages ?? [];
  const initialDirectMessages: Record<string, import("@/lib/schema").CampaignDirectMessage[]> = {};
  for (const p of myParticipations) {
    initialDirectMessages[p.id] = allDMs.filter(
      (m) => m.participation_id === p.id
    );
  }

  // 캠페인별 참여 인원 수 집계
  const participationCounts: Record<string, number> = {};
  for (const p of (db.campaign_participations ?? [])) {
    participationCounts[p.campaign_id] = (participationCounts[p.campaign_id] ?? 0) + 1;
  }

  // 내 제출물 (campaign_submissions 워크플로우)
  const mySubmissions = (db.campaign_submissions ?? []).filter(
    (s) => s.creator_id === user.id
  );
  // 제출물별 댓글 (submission_id -> comments)
  const allSubmissionComments = db.submission_comments ?? [];
  const initialSubmissionComments: Record<string, import("@/lib/schema").SubmissionComment[]> = {};
  for (const sub of mySubmissions) {
    initialSubmissionComments[sub.id] = allSubmissionComments.filter(
      (c) => c.submission_id === sub.id
    );
  }

  // 댓글 작성자 이름 조회용 프로필 맵
  const profileMap: Record<string, string> = {};
  for (const p of db.profiles) {
    profileMap[p.id] = displayName(p);
  }

  // 캠페인별 건당 예상 수익 (최고관리자 정책설정의 크리에이터 지급액 기준)
  const expectedRewards: Record<string, { deploy: number; video: number }> = {};
  for (const c of campaigns) {
    expectedRewards[c.id] = {
      deploy: creatorDeployPayout(db, c.platforms),
      video: creatorVideoPayout(db, c.video_duration_tier),
    };
  }

  // ── 배포 영상 풀 정보 (순차 게이트 + 분배/소진 + 내 분배 영상) ──────────
  const distributionInfo: Record<
    string,
    {
      pool: boolean;
      unlocked: boolean;
      remaining: number;
      total: number;
      /** 모집 마감(정원 충족) 여부 */
      deployFull: boolean;
      videoFull: boolean;
      /** 참여 기한 경과 여부 (한국 시간 마감일 23:59 기준) */
      expired: boolean;
    }
  > = {};
  for (const c of campaigns) {
    const pool = hasVideoPool(c);
    const stats = poolStats(db, c.id);
    const deployCap = participationCapacity(db, c, "deploy");
    const videoCap = participationCapacity(db, c, "video_production");
    distributionInfo[c.id] = {
      pool,
      unlocked: isDistributionUnlocked(db, c),
      // 영상 수보다 배포 건수가 많으면 영상을 재사용 배정하므로, 남은 배포 가능 수 = 정원 잔여
      remaining: stats.total > 0 || c.uploaded_video_url ? Math.max(0, deployCap.limit - deployCap.active) : 0,
      total: stats.total,
      deployFull: !campaignAcceptsType(c, "deploy") || deployCap.full,
      videoFull: !campaignAcceptsType(c, "video_production") || videoCap.full,
      expired: isPastDeadline(c.end_date),
    };
  }
  // 내 배포 참여에 분배된 영상 (participation_id -> 영상 정보)
  const myAssignedVideos: Record<
    string,
    { id: string; url: string | null; file_data: string | null; file_name: string | null; status: string }
  > = {};
  for (const p of myParticipations) {
    if ((p.participation_type ?? "deploy") !== "deploy") continue;
    const v = campaignPoolVideos(db, p.campaign_id).find((x) => x.assigned_participation_id === p.id);
    if (v) {
      myAssignedVideos[p.id] = {
        id: v.id,
        url: v.video_url,
        file_data: v.file_data,
        file_name: v.file_name,
        status: v.status,
      };
    }
  }

  return (
    <div>
      <PageHeader
        title="캠페인"
        description="광고주 캠페인과 바이브포터 의뢰에 참여하고 수익을 올려보세요."
      />
      <CreatorCampaignsUI
        campaigns={campaigns}
        myParticipations={myParticipations}
        initialComments={initialComments}
        initialDirectMessages={initialDirectMessages}
        participationCounts={participationCounts}
        userId={user.id}
        userName={displayName(user)}
        mySubmissions={mySubmissions}
        initialSubmissionComments={initialSubmissionComments}
        profileMap={profileMap}
        expectedRewards={expectedRewards}
        distributionInfo={distributionInfo}
        myAssignedVideos={myAssignedVideos}
        favoriteCampaignIds={favoriteCampaignIds}
      />
    </div>
  );
}
