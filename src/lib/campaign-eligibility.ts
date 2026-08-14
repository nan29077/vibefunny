import type { AdCampaign, Database, Profile } from "./schema";

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
    reasons.push("캠페인 대상 플랫폼의 인증된 채널이 필요합니다.");
  }
  return { eligible: reasons.length === 0, reasons };
}

// 정원 계산에서 제외할 상태: 취소·반려된 참여자는 정원을 차지하지 않음
const CAPACITY_EXCLUDED_STATUSES = new Set([
  "cancelled",
  "application_rejected",
  "rejected",
  "video_rejected",
  "deploy_rejected",
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
