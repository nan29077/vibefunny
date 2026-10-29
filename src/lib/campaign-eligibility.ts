import type { AdCampaign, Database, Profile, SocialPlatform } from "./schema";

const FOLLOWER_MINIMUM: Record<string, number> = {
  none: 0, "10k": 10_000, "50k": 50_000, "100k": 100_000, "500k": 500_000, "1m": 1_000_000,
};

export function campaignEligibility(db: Database, creator: Profile, campaign: AdCampaign): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const requiredFollowers = FOLLOWER_MINIMUM[campaign.creator_min_followers ?? "none"] ?? 0;
  const accounts = (db.social_accounts ?? []).filter((item) => item.creator_id === creator.id && item.verified_status === "verified");
  const maxFollowers = Math.max(0, ...accounts.map((item) => item.follower_count));
  if (maxFollowers < requiredFollowers) reasons.push(`인증된 채널 팔로워가 최소 ${requiredFollowers.toLocaleString()}명 이상이어야 합니다.`);
  if (campaign.creator_gender && campaign.creator_gender !== "all" && creator.creator_gender !== campaign.creator_gender) {
    reasons.push("캠페인 성별 조건과 프로필 정보가 일치하지 않습니다.");
  }
  if (campaign.creator_age_group && campaign.creator_age_group !== "all" && creator.creator_age_group !== campaign.creator_age_group) {
    reasons.push("캠페인 연령대 조건과 프로필 정보가 일치하지 않습니다.");
  }
  if (campaign.platforms.length > 0 && !campaign.platforms.some((platform) => accounts.some((account) => account.platform === platform))) {
    const waiting = (db.social_accounts ?? []).some(
      (item) => item.creator_id === creator.id && item.verified_status === "pending" && campaign.platforms.includes(item.platform)
    );
    reasons.push(
      waiting
        ? "대상 플랫폼 채널이 관리자 인증 대기 중입니다. 인증 완료 후 참여할 수 있습니다."
        : "캠페인 대상 플랫폼의 인증된 채널이 필요합니다. 'SNS 계정 관리'에서 채널을 등록하고 인증을 받아주세요."
    );
  }
  return { eligible: reasons.length === 0, reasons };
}

// 정원 계산에서 제외할 상태: 취소·반려된 참여자는 정원을 차지하지 않음
// (video_rejected/deploy_rejected 는 재제출 가능한 상태이므로 정원을 계속 차지한다 → 초과 지급 방지)
const CAPACITY_EXCLUDED_STATUSES = new Set([
  "cancelled",
  "application_rejected",
  "rejected",
]);

export function participationCapacity(db: Database, campaign: AdCampaign, type: "deploy" | "video_production") {
  const active = (db.campaign_participations ?? []).filter(
    (item) =>
      item.campaign_id === campaign.id &&
      (item.participation_type ?? "deploy") === type &&
      !CAPACITY_EXCLUDED_STATUSES.has(item.status)
  ).length;
  const typeLimit = type === "video_production"
    ? Math.max(0, campaign.video_production_count ?? 0)
    : Math.max(0, campaign.distribution_count ?? 0);
  const limit = typeLimit > 0 ? typeLimit : (campaign.participation_limit ?? 0);
  return { active, limit, full: limit > 0 && active >= limit };
}

/** 캠페인에 플랫폼별 배포 건수가 지정돼 있으면 그 목표치를, 아니면 null */
export function platformTargets(campaign: AdCampaign): Partial<Record<SocialPlatform, number>> | null {
  const dist = campaign.platform_distributions;
  if (!dist) return null;
  const entries = Object.entries(dist).filter(([p, n]) => campaign.platforms.includes(p as SocialPlatform) && (n ?? 0) > 0);
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as Partial<Record<SocialPlatform, number>>;
}

/** 플랫폼별 배포 정원 (플랫폼 목표가 없으면 limit=0 → 제한 없음) */
export function platformCapacity(db: Database, campaign: AdCampaign, platform: SocialPlatform) {
  const targets = platformTargets(campaign);
  const limit = targets ? Math.max(0, Math.floor(targets[platform] ?? 0)) : 0;
  const active = (db.campaign_participations ?? []).filter(
    (item) =>
      item.campaign_id === campaign.id &&
      (item.participation_type ?? "deploy") === "deploy" &&
      item.platform === platform &&
      !CAPACITY_EXCLUDED_STATUSES.has(item.status)
  ).length;
  // 목표가 있는 캠페인에서 목표에 없는 플랫폼(0건)은 참여 불가
  const closed = targets ? limit === 0 : false;
  return { active, limit, full: closed || (limit > 0 && active >= limit) };
}

/** 크리에이터가 인증받은 채널 중 이 캠페인에 배포할 수 있는 플랫폼 목록 (정원이 남은 순) */
export function deployablePlatforms(db: Database, creatorId: string, campaign: AdCampaign): SocialPlatform[] {
  const verified = new Set(
    (db.social_accounts ?? [])
      .filter((a) => a.creator_id === creatorId && a.verified_status === "verified")
      .map((a) => a.platform)
  );
  return campaign.platforms
    .filter((p) => verified.has(p) && !platformCapacity(db, campaign, p).full)
    .sort((a, b) => {
      const ca = platformCapacity(db, campaign, a);
      const cb = platformCapacity(db, campaign, b);
      const ra = ca.limit > 0 ? ca.limit - ca.active : Number.MAX_SAFE_INTEGER;
      const rb = cb.limit > 0 ? cb.limit - cb.active : Number.MAX_SAFE_INTEGER;
      return rb - ra;
    });
}
