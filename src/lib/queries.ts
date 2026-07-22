import { getDb } from "./db";
import type { Database, Platform, SocialPlatform } from "./schema";

// ===========================================================================
// 읽기 전용 조회 헬퍼 (서버 컴포넌트에서 사용)
// ===========================================================================

export function nameOf(db: Database, userId: string | null): string {
  if (!userId) return "-";
  return db.profiles.find((p) => p.id === userId)?.name ?? "(알수없음)";
}

export function categoryName(db: Database, id: string | null): string {
  if (!id) return "-";
  return db.categories.find((c) => c.id === id)?.name ?? "-";
}

export function categoriesByPlatform(db: Database, platform: Platform) {
  return db.categories
    .filter((c) => c.platform === platform && c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function adminStats() {
  const db = getDb();
  const members = db.profiles.filter((p) => p.role !== "admin");
  const advertisers = members.filter((p) => p.role === "advertiser");
  const sumPaid = (type: string) =>
    db.payments
      .filter((p) => p.status === "paid" && p.payment_type === type)
      .reduce((s, p) => s + p.amount, 0);

  const totalPointCharged = db.point_transactions
    .filter((t) => t.type === "charge")
    .reduce((s, t) => s + t.amount, 0);
  const totalAdSpend = db.point_transactions
    .filter((t) => t.type === "spend")
    .reduce((s, t) => s - t.amount, 0); // spend는 음수
  const pendingPayout = db.wallets.reduce((s, w) => s + w.available_balance, 0);
  const totalPayments = db.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  return {
    totalMembers: members.length,
    creators: members.filter((p) => p.role === "creator").length,
    buyers: members.filter((p) => false /* buyer role removed */).length,
    advertisers: advertisers.length,
    executionCompanies: advertisers.filter((p) => p.advertiser_type === "execution_company").length,
    agencies: advertisers.filter((p) => p.advertiser_type === "agency").length,
    totalPayments,
    totalPointCharged,
    totalAdSpend,
    pendingPayout,
    videosForSale: db.videos.filter((v) => v.status === "available").length,
    activeCampaigns: db.ad_campaigns.filter((c) =>
      ["published", "recruiting", "in_progress", "submitted"].includes(c.status)
    ).length,
  };
}

// 캠페인 예상 비용 계산 (서버 기준, 4.5/5.5)
export interface CampaignCostInput {
  campaign_type: string;
  platforms: SocialPlatform[];
  distribution_count: number;
  /** 영상제작 건수 (create_and_distribute / create_only). 미지정 시 distribution_count로 하위호환 */
  video_production_count?: number;
  /** 영상 길이 구간 키 (15s|30s|60s|90s). 지정 시 해당 구간의 광고주 청구단가로 제작비 산정 */
  video_duration_tier?: string | null;
}

/** 영상 길이 구간(키)별 광고주 청구단가. 구간 미지정 시 extra_creation_advertiser_charge로 폴백 */
export function advertiserVideoCharge(db: Database, tierKey?: string | null): number {
  const tier = (db.settings.video_pricing_tiers ?? []).find((t) => t.key === tierKey);
  if (tier && typeof tier.advertiser_charge === "number") return tier.advertiser_charge;
  return db.settings.extra_creation_advertiser_charge;
}

/** 영상 길이 구간(키)별 크리에이터 제작 단가(지급액). 미지정 시 extra_creation_creator_payout로 폴백 */
export function creatorVideoPayout(db: Database, tierKey?: string | null): number {
  const tier = (db.settings.video_pricing_tiers ?? []).find((t) => t.key === tierKey);
  if (tier && typeof tier.amount === "number") return tier.amount;
  return db.settings.extra_creation_creator_payout;
}

/** 캠페인 플랫폼 기준 배포 1건당 크리에이터 지급액(평균) */
export function creatorDeployPayout(db: Database, platforms: SocialPlatform[]): number {
  const rates = db.settings.distribution_rates.filter((r) => platforms.includes(r.platform));
  if (rates.length === 0) return 0;
  return Math.round(rates.reduce((s, r) => s + r.creator_payout, 0) / rates.length);
}

export function computeCampaignCost(db: Database, input: CampaignCostInput) {
  const deployCount = Math.max(0, Math.floor(input.distribution_count));
  const videoProdCount = Math.max(
    0,
    Math.floor(input.video_production_count ?? (input.campaign_type === "create_only" ? deployCount : 0))
  );
  const rates = db.settings.distribution_rates.filter((r) =>
    input.platforms.includes(r.platform)
  );
  const perDist =
    rates.length > 0
      ? Math.round(rates.reduce((s, r) => s + r.advertiser_charge, 0) / rates.length)
      : 0;
  // 영상제작 단가: 길이 구간이 지정되면 해당 구간 광고주 청구단가, 아니면 기존 플랫 단가
  const extra = advertiserVideoCharge(db, input.video_duration_tier);

  let distributionCost = 0;
  let creationCost = 0;

  if (input.campaign_type === "create_only") {
    // 단순 제작: 배포 없음, video_production_count = 제작 영상 수
    creationCost = extra * videoProdCount;
  } else {
    distributionCost = perDist * deployCount;
    if (input.campaign_type === "create_and_distribute") {
      // 영상제작 건수가 별도로 지정된 경우 그 값 사용, 없으면 배포 건수로 호환
      const effectiveVideoProdCount = input.video_production_count != null ? videoProdCount : deployCount;
      creationCost = extra * effectiveVideoProdCount;
    }
  }
  return {
    perDist,
    perCreation: extra,
    distributionCost,
    creationCost,
    total: distributionCost + creationCost,
  };
}

/** 영상 길이 -> 제작 단가 (관리자 설정 기준) */
export function priceForDuration(db: Database, seconds: number): number {
  const tiers = db.settings.video_pricing_tiers
    .filter((t) => t.max_seconds !== null)
    .sort((a, b) => (a.max_seconds! - b.max_seconds!));
  for (const t of tiers) {
    if (seconds <= (t.max_seconds as number)) return t.amount;
  }
  return tiers[tiers.length - 1]?.amount ?? 0;
}
