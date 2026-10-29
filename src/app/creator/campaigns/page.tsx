import { requireRole } from "@/lib/auth";
import { deployablePlatforms, platformTargets } from "@/lib/campaign-eligibility";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CreatorCampaignsUI } from "@/components/campaigns/creator-campaigns-ui";
import { creatorDeployPayout, creatorVideoPayout } from "@/lib/queries";
import { displayName } from "@/lib/schema";
import { hasVideoPool, isDistributionUnlocked, poolStats, campaignPoolVideos } from "@/lib/distribution";
import { participationCapacity } from "@/lib/campaign-eligibility";
import { campaignAcceptsType, isPastDeadline } from "@/lib/campaign-workflow";
import { VibeOnlyNotice } from "@/components/membership/vibe-only-notice";
import { isVibeMember } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default function CreatorCampaignsPage() {
  const user = requireRole("creator");
  const db = getDb();

  // 내 참여 기록
  const myParticipations = (db.campaign_participations ?? []).filter(
    (p) => p.creator_id === user.id
  );
  // 참여가 확정된(선발 이후) 캠페인 — 이 캠페인에만 첨부 원본 등 민감 정보를 전달한다
  const confirmedIds = new Set(
    myParticipations
      .filter((p) => !["applied", "application_rejected", "cancelled"].includes(p.status))
      .map((p) => p.campaign_id)
  );

  // 노출할 캠페인 (recruiting/published/in_progress/submitted, 완료는 내가 참여한 것만)
  // 클라이언트로 내려보내기 전에 관리자 메모·첨부 원본 등을 제거한다
  const campaigns = db.ad_campaigns
    .filter((c) =>
      ["recruiting", "published", "in_progress", "submitted"].includes(c.status) ||
      (c.status === "completed" && myParticipations.some((p) => p.campaign_id === c.id))
    )
    .map((c) => {
      const confirmed = confirmedIds.has(c.id);
      return {
        ...c,
        admin_memo: null,
        attachment_file_data: confirmed ? c.attachment_file_data : null,
      };
    });
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
  // 화면에 필요한 사람(댓글·메시지 작성자, 캠페인 광고주, 나)의 표시 이름만 전달 — 전체 회원 목록 전송 방지
  const neededIds = new Set<string>([user.id, ...campaigns.map((c) => c.advertiser_id)]);
  for (const list of Object.values(initialComments)) for (const cm of list) neededIds.add(cm.author_id);
  for (const list of Object.values(initialSubmissionComments)) for (const cm of list) neededIds.add((cm as { author_id?: string }).author_id ?? "");
  const profileMap: Record<string, string> = {};
  for (const p of db.profiles) {
    if (neededIds.has(p.id)) profileMap[p.id] = displayName(p);
  }

  // 캠페인별 건당 예상 수익 (최고관리자 정책설정의 크리에이터 지급액 기준)
  const expectedRewards: Record<string, { deploy: number; video: number }> = {};
  for (const c of campaigns) {
    // 배포 단가: 이미 배정된 플랫폼 → 배정 예정 플랫폼(인증 채널 + 정원 남음) → 대상 플랫폼 평균 순
    const myDeploy = (db.campaign_participations ?? []).find(
      (p) => p.campaign_id === c.id && p.creator_id === user.id && (p.participation_type ?? "deploy") === "deploy" && p.status !== "cancelled"
    );
    // 플랫폼별 건수가 지정된 캠페인만 플랫폼 단가를 쓴다 (그 외는 광고주 청구와 같은 평균 단가)
    const deployPlatform = platformTargets(c) ? (myDeploy?.platform ?? deployablePlatforms(db, user.id, c)[0]) : undefined;
    expectedRewards[c.id] = {
      deploy: creatorDeployPayout(db, deployPlatform && c.platforms.includes(deployPlatform) ? [deployPlatform] : c.platforms, c),
      video: creatorVideoPayout(db, c.video_duration_tier, c),
    };
  }

  // ── 배포 영상 풀 정보 (순차 게이트 + 분배/소진 + 내 분배 영상) ──────────
  const myVerifiedPlatforms = (db.social_accounts ?? [])
    .filter((a) => a.creator_id === user.id && a.verified_status === "verified")
    .map((a) => a.platform);
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
      // 플랫폼별 배포 건수가 지정된 캠페인은 내 인증 채널 플랫폼에 남은 자리가 있어야 참여 가능
      deployFull: !campaignAcceptsType(c, "deploy") || deployCap.full || (platformTargets(c) !== null && myVerifiedPlatforms.some((pf) => c.platforms.includes(pf)) && deployablePlatforms(db, user.id, c).length === 0),
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
        description="광고주 캠페인에 참여하고 수익을 올려보세요."
      />
      {!isVibeMember(db, user) && (
        <div className="mb-4">
          <VibeOnlyNotice feature="캠페인 참여" signupFee={db.settings.fees.creator.signup_fee_amount} compact />
        </div>
      )}
      <CreatorCampaignsUI
        campaigns={campaigns.map((c) => ({
          ...c,
          // 광고주 집행액·정산 단가 스냅샷은 크리에이터에게 보내지 않는다 (예상 수익은 expectedRewards 로 따로 전달)
          total_cost: 0,
          point_spent: 0,
          creator_rate_snapshot: undefined,
        }))}
        myParticipations={myParticipations}
        canJoin={isVibeMember(db, user)}
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
