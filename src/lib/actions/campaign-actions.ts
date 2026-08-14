"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tx } from "../db";
import { requireRole, getCurrentUser } from "../auth";
import { genId } from "../crypto";
import {
  addPointTx,
  addWalletTxOnce,
  audit,
  createAdvertiserCommission,
  ensurePointWallet,
  notifyUser,
} from "../services";
import { computeCampaignCost, creatorDeployPayout, creatorVideoPayout } from "../queries";
import { syncCampaignVideos, markVideoDistributed, hasVideoPool, isDistributionUnlocked, allocateVideoForParticipation } from "../distribution";
import { ALL_SOCIAL_PLATFORMS, type AdCampaign, type CampaignType, type Platform, type SocialPlatform } from "../schema";
import type { ActionState } from "@/components/form";
import { campaignEligibility, participationCapacity } from "../campaign-eligibility";

const now = () => new Date().toISOString();

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// === ADVERTISER: 캠페인 신청 + 포인트 차감 (5.5) ======================
const campaignSchema = z.object({
  title: z.string().min(1, "캠페인 제목을 입력하세요."),
  description: z.string().default(""),
  campaign_type: z.enum([
    "create_and_distribute",
    "distribute_own_video",
    "distribute_existing_video",
    "create_only",
  ]),
  category_id: z.string().optional(),
  distribution_count: z.coerce.number().int().min(0).default(0),
  video_production_count: z.coerce.number().int().min(0).default(0),
  target_keywords: z.string().optional(),
  reference_links: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  uploaded_video_url: z.string().optional(),
  // 파일 첨부
  attachment_file_data: z.string().optional(),
  attachment_file_name: z.string().optional(),
  attachment_file_type: z.string().optional(),
  // 영상 제작 브리프
  brief_product_name: z.string().optional(),
  brief_product_detail: z.string().optional(),
  brief_youtube_category: z.string().optional(),
  brief_instagram_category: z.string().optional(),
  brief_tiktok_category: z.string().optional(),
  brief_tone: z.string().optional(),
  brief_style: z.string().optional(),
  brief_target_audience: z.string().optional(),
  brief_key_messages: z.string().optional(),
  brief_avoid: z.string().optional(),
  brief_hashtags: z.string().optional(),
  // 브랜드 정보
  brand_name: z.string().optional(),
  industry: z.string().optional(),
  website_url: z.string().optional(),
  // 크리에이터 자격
  creator_min_followers: z.string().optional(),
  creator_gender: z.string().optional(),
  creator_age_group: z.string().optional(),
  creator_requirements: z.string().optional(),
  // 브랜드 세이프티
  brand_forbidden_words: z.string().optional(),
  brand_no_competitor: z.coerce.boolean().optional(),
  brand_no_adult: z.coerce.boolean().optional(),
  brand_no_violence: z.coerce.boolean().optional(),
  brand_no_politics: z.coerce.boolean().optional(),
  // 성과 추적
  utm_link: z.string().optional(),
  promo_code: z.string().optional(),
  kpi_goals: z.string().optional(),
  // 약관 동의
  terms_agreed: z.coerce.boolean().optional(),
  brief_facebook_category: z.string().optional(),
  // 영상 길이 구간 (15s|30s|60s|90s)
  video_duration_tier: z.string().optional(),
});

export async function createCampaignAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireRole("advertiser");
  const platforms = fd.getAll("platforms").map(String) as SocialPlatform[];
  if (platforms.length === 0 || platforms.some((item) => !ALL_SOCIAL_PLATFORMS.includes(item))) {
    return { ok: false, message: "플랫폼을 1개 이상 선택하세요." };
  }
  // 플랫폼별 배포 건수 읽기
  const platformDistributions: Partial<Record<SocialPlatform, number>> = {};
  for (const p of platforms) {
    const val = fd.get(`platform_distribution_${p}`);
    if (val !== null && val !== "") platformDistributions[p] = Math.max(0, Number(val));
  }

  const parsed = campaignSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") ?? "",
    campaign_type: fd.get("campaign_type"),
    category_id: fd.get("category_id") || undefined,
    distribution_count: fd.get("distribution_count"),
    video_production_count: fd.get("video_production_count"),
    target_keywords: fd.get("target_keywords") || undefined,
    reference_links: fd.get("reference_links") || undefined,
    start_date: fd.get("start_date") || undefined,
    end_date: fd.get("end_date") || undefined,
    uploaded_video_url: fd.get("uploaded_video_url") || undefined,
    attachment_file_data: fd.get("attachment_file_data") || undefined,
    attachment_file_name: fd.get("attachment_file_name") || undefined,
    attachment_file_type: fd.get("attachment_file_type") || undefined,
    brief_product_name: fd.get("brief_product_name") || undefined,
    brief_product_detail: fd.get("brief_product_detail") || undefined,
    brief_youtube_category: fd.get("brief_youtube_category") || undefined,
    brief_instagram_category: fd.get("brief_instagram_category") || undefined,
    brief_tiktok_category: fd.get("brief_tiktok_category") || undefined,
    brief_tone: fd.get("brief_tone") || undefined,
    brief_style: fd.get("brief_style") || undefined,
    brief_target_audience: fd.get("brief_target_audience") || undefined,
    brief_key_messages: fd.get("brief_key_messages") || undefined,
    brief_avoid: fd.get("brief_avoid") || undefined,
    brief_hashtags: fd.get("brief_hashtags") || undefined,
    brand_name: fd.get("brand_name") || undefined,
    industry: fd.get("industry") || undefined,
    website_url: fd.get("website_url") || undefined,
    creator_min_followers: fd.get("creator_min_followers") || undefined,
    creator_gender: fd.get("creator_gender") || undefined,
    creator_age_group: fd.get("creator_age_group") || undefined,
    creator_requirements: fd.get("creator_requirements") || undefined,
    brand_forbidden_words: fd.get("brand_forbidden_words") || undefined,
    brand_no_competitor: fd.get("brand_no_competitor") === "on" || undefined,
    brand_no_adult: fd.get("brand_no_adult") === "on" || undefined,
    brand_no_violence: fd.get("brand_no_violence") === "on" || undefined,
    brand_no_politics: fd.get("brand_no_politics") === "on" || undefined,
    utm_link: fd.get("utm_link") || undefined,
    promo_code: fd.get("promo_code") || undefined,
    kpi_goals: fd.get("kpi_goals") || undefined,
    terms_agreed: fd.get("terms_agreed") === "on" || undefined,
    brief_facebook_category: fd.get("brief_facebook_category") || undefined,
    video_duration_tier: fd.get("video_duration_tier") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, message: "입력값을 확인하세요.", fieldErrors };
  }
  const d = parsed.data;
  const ctype = d.campaign_type as CampaignType;
  const videoRequired = ctype === "create_and_distribute" || ctype === "create_only";
  if (!d.terms_agreed) return { ok: false, message: "캠페인 등록 약관에 동의해야 합니다." };
  if (d.start_date && d.end_date && new Date(d.start_date).getTime() > new Date(d.end_date).getTime()) {
    return { ok: false, message: "종료일은 시작일 이후여야 합니다." };
  }
  if (ctype === "create_only" && d.video_production_count < 1) {
    return { ok: false, message: "영상 제작 건수를 1건 이상 입력하세요." };
  }
  if (ctype !== "create_only" && d.distribution_count < 1) {
    return { ok: false, message: "배포 건수를 1건 이상 입력하세요." };
  }
  if (ctype === "create_and_distribute" && d.video_production_count < 1) {
    return { ok: false, message: "영상 제작 건수를 1건 이상 입력하세요." };
  }
  const platformCountSum = Object.values(platformDistributions).reduce((sum, value) => sum + (value ?? 0), 0);
  if (platformCountSum > 0 && platformCountSum !== d.distribution_count) {
    return { ok: false, message: "플랫폼별 배포 건수 합계가 전체 배포 건수와 같아야 합니다." };
  }

  // 광고주 직접 등록 영상(1~N개) 수집 — distribute_own_video / distribute_existing_video
  // 폼에서 pool_video_count + pool_video_{i}_(url|file_data|file_name|file_type) 전송
  type PoolVideoInput = { url: string; file_data: string; file_name: string; file_type: string };
  const poolVideos: PoolVideoInput[] = [];
  if (ctype === "distribute_own_video" || ctype === "distribute_existing_video") {
    const cnt = Math.max(0, Number(fd.get("pool_video_count") ?? 0));
    for (let i = 0; i < cnt; i++) {
      const url = String(fd.get(`pool_video_${i}_url`) ?? "").trim();
      const fileData = String(fd.get(`pool_video_${i}_file_data`) ?? "").trim();
      const fileName = String(fd.get(`pool_video_${i}_file_name`) ?? "").trim();
      const fileType = String(fd.get(`pool_video_${i}_file_type`) ?? "").trim();
      if (url || fileData) poolVideos.push({ url, file_data: fileData, file_name: fileName, file_type: fileType });
    }
    // 레거시 단일 입력 폴백 (uploaded_video_url) — 멀티 입력이 없을 때만
    if (poolVideos.length === 0 && d.uploaded_video_url) {
      poolVideos.push({ url: d.uploaded_video_url, file_data: "", file_name: "", file_type: "" });
    }
    // 배포 건수(N)를 초과하는 영상은 잘라낸다 (영상은 1~N개)
    if (d.distribution_count > 0 && poolVideos.length > d.distribution_count) {
      poolVideos.length = d.distribution_count;
    }
    if (poolVideos.length === 0) {
      return { ok: false, message: "배포할 영상 URL 또는 파일을 1개 이상 등록하세요." };
    }
  }

  let outcome: ActionState = { ok: false };
  let needCharge = false;
  tx((db) => {
    // 비용은 서버에서 계산 (클라이언트 금액 신뢰 금지)
    const cost = computeCampaignCost(db, {
      campaign_type: ctype,
      platforms,
      distribution_count: d.distribution_count,
      platform_distributions: platformDistributions,
      video_production_count: d.video_production_count,
      video_duration_tier: d.video_duration_tier ?? null,
    }).total;

    const pw = ensurePointWallet(db, user.id);
    if (pw.point_balance < cost) {
      needCharge = true;
      outcome = { ok: false, message: "포인트가 부족합니다. 충전 페이지로 이동합니다." };
      return;
    }

    const campaign: AdCampaign = {
      id: genId(),
      advertiser_id: user.id,
      title: d.title,
      description: d.description ?? "",
      campaign_type: ctype,
      platforms,
      category_id: d.category_id ?? null,
      video_required: videoRequired,
      uploaded_video_url: d.uploaded_video_url ?? null,
      distribution_count: d.distribution_count,
      target_keywords: d.target_keywords ?? null,
      reference_links: d.reference_links ?? null,
      start_date: d.start_date ?? null,
      end_date: d.end_date ?? null,
      total_cost: cost,
      point_spent: cost,
      status: "admin_review", // 포인트 차감 후 관리자 승인 대기
      admin_memo: null,
      created_at: now(),
      updated_at: now(),
      approved_at: null,
      published_at: null,
      brief_product_name: d.brief_product_name ?? null,
      brief_product_detail: d.brief_product_detail ?? null,
      brief_youtube_category: d.brief_youtube_category ?? null,
      brief_instagram_category: d.brief_instagram_category ?? null,
      brief_tiktok_category: d.brief_tiktok_category ?? null,
      brief_tone: d.brief_tone ?? null,
      brief_style: d.brief_style ?? null,
      brief_target_audience: d.brief_target_audience ?? null,
      brief_key_messages: d.brief_key_messages ?? null,
      brief_avoid: d.brief_avoid ?? null,
      brief_hashtags: d.brief_hashtags ?? null,
      attachment_file_data: d.attachment_file_data ?? null,
      attachment_file_name: d.attachment_file_name ?? null,
      attachment_file_type: d.attachment_file_type ?? null,
      platform_distributions: Object.keys(platformDistributions).length > 0 ? platformDistributions : undefined,
      brand_name: d.brand_name ?? null,
      industry: d.industry ?? null,
      website_url: d.website_url ?? null,
      creator_min_followers: d.creator_min_followers ?? null,
      creator_gender: d.creator_gender ?? null,
      creator_age_group: d.creator_age_group ?? null,
      creator_requirements: d.creator_requirements ?? null,
      brand_forbidden_words: d.brand_forbidden_words ?? null,
      brand_no_competitor: d.brand_no_competitor ?? false,
      brand_no_adult: d.brand_no_adult ?? true,
      brand_no_violence: d.brand_no_violence ?? true,
      brand_no_politics: d.brand_no_politics ?? false,
      utm_link: d.utm_link ?? null,
      promo_code: d.promo_code ?? null,
      kpi_goals: d.kpi_goals ?? null,
      terms_agreed: d.terms_agreed ?? false,
      brief_facebook_category: d.brief_facebook_category ?? null,
      video_production_count: d.video_production_count ?? 0,
      video_duration_tier: d.video_duration_tier ?? null,
    };
    db.ad_campaigns.push(campaign);

    // 광고주 직접 등록 영상을 배포 풀(campaign_videos)에 생성 (1인 1영상 배타 분배 대상)
    if (poolVideos.length > 0) {
      if (!db.campaign_videos) db.campaign_videos = [];
      for (const pv of poolVideos) {
        db.campaign_videos.push({
          id: genId(),
          campaign_id: campaign.id,
          source: "advertiser_uploaded",
          title: null,
          video_url: pv.url || null,
          file_data: pv.file_data || null,
          file_name: pv.file_name || null,
          file_type: pv.file_type || null,
          source_participation_id: null,
          produced_by_creator_id: null,
          status: "unassigned",
          assigned_creator_id: null,
          assigned_participation_id: null,
          assigned_at: null,
          downloaded_at: null,
          distributed_at: null,
          created_at: now(),
          updated_at: now(),
        });
      }
    }

    // 포인트 차감 (ledger)
    addPointTx(db, {
      advertiserId: user.id,
      type: "spend",
      amount: -cost,
      campaignId: campaign.id,
      memo: `캠페인 결제: ${campaign.title}`,
    });

    // 실행사 수수료: 기준이 '대행사 광고 주문 차감액'이면 이 시점에 생성
    if (db.settings.advertiser_commission_basis === "agency_spend") {
      createAdvertiserCommission(db, {
        agencyId: user.id,
        baseAmount: cost,
        campaignId: campaign.id,
        memo: `광고 주문 차감액 기준 수수료: ${campaign.title}`,
      });
    }

    audit(db, { actorId: user.id, action: "create_campaign", targetTable: "ad_campaigns", targetId: campaign.id });
    outcome = { ok: true, message: "캠페인이 접수되어 관리자 승인 대기 중입니다." };
  });

  if (needCharge) redirect("/advertiser/points?error=insufficient");
  if (outcome.ok) {
    revalidatePath("/advertiser/campaigns");
    redirect("/advertiser/campaigns");
  }
  return outcome;
}

// === ADMIN: 캠페인 승인(노출)/반려 ====================================
export async function reviewCampaignAction(fd: FormData): Promise<void> {
  const user = requireRole("admin");
  const id = String(fd.get("id") || "");
  const decision = String(fd.get("decision") || ""); // publish | reject
  const memo = String(fd.get("admin_memo") || "");
  tx((db) => {
    const c = db.ad_campaigns.find((x) => x.id === id);
    if (!c || c.status !== "admin_review") return;
    if (decision === "publish") {
      c.status = "recruiting";
      c.approved_at = now();
      c.published_at = now();
      c.admin_memo = memo || null;
    } else if (decision === "reject") {
      c.status = "rejected";
      c.admin_memo = memo || null;
      // 포인트 환불
      addPointTx(db, {
        advertiserId: c.advertiser_id,
        type: "refund",
        amount: c.point_spent,
        campaignId: c.id,
        memo: `캠페인 반려 환불: ${c.title}`,
      });
      // 생성된 pending 수수료 취소
      db.wallet_transactions
        .filter((t) => t.related_id === c.id && t.type === "advertiser_commission" && t.status === "pending")
        .forEach((t) => (t.status = "cancelled"));
    }
    c.updated_at = now();
    audit(db, { actorId: user.id, action: `campaign_${decision}`, targetTable: "ad_campaigns", targetId: id });
  });
  revalidatePath("/admin/campaigns");
}

// === CREATOR: 캠페인 참여 신청 ========================================
export async function applyCampaignAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const campaignId = String(fd.get("campaign_id") || "");
  tx((db) => {
    const c = db.ad_campaigns.find((x) => x.id === campaignId);
    if (!c || !["recruiting", "published", "in_progress"].includes(c.status)) return;
    if (db.campaign_applications.some((a) => a.campaign_id === campaignId && a.creator_id === user.id)) return;
    db.campaign_applications.push({
      id: genId(),
      campaign_id: campaignId,
      creator_id: user.id,
      status: "applied",
      created_at: now(),
      updated_at: now(),
    });
  });
  revalidatePath("/creator/campaigns");
}

// === ADMIN/ADVERTISER: 참여자 승인/반려 ===============================
export async function decideCampaignApplicationAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "advertiser")) return;
  const appId = String(fd.get("application_id") || "");
  const decision = String(fd.get("decision") || ""); // approve | reject
  tx((db) => {
    const app = db.campaign_applications.find((a) => a.id === appId);
    if (!app) return;
    const c = db.ad_campaigns.find((x) => x.id === app.campaign_id);
    if (!c) return;
    if (user.role === "advertiser" && c.advertiser_id !== user.id) return;
    app.status = decision === "approve" ? "approved" : "rejected";
    app.updated_at = now();
    if (decision === "approve" && c.status === "recruiting") {
      c.status = "in_progress";
      c.updated_at = now();
    }
  });
  revalidatePath("/advertiser/campaigns");
  revalidatePath("/admin/campaigns");
}

// === CREATOR: 배포 증빙 제출 ==========================================
export async function submitCampaignProofAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const campaignId = String(fd.get("campaign_id") || "");
  const platform = String(fd.get("platform") || "youtube") as Platform;
  const postUrl = String(fd.get("post_url") || "").trim();
  const proofImageUrl = String(fd.get("proof_image_url") || "").trim();
  const submittedVideoUrl = String(fd.get("submitted_video_url") || "").trim();
  const description = String(fd.get("description") || "");
  if (!postUrl && !submittedVideoUrl) return;
  tx((db) => {
    const c = db.ad_campaigns.find((x) => x.id === campaignId);
    if (!c) return;
    const app = db.campaign_applications.find(
      (a) => a.campaign_id === campaignId && a.creator_id === user.id && a.status === "approved"
    );
    if (!app) return; // 승인된 참여자만 제출 가능
    // 중복 제출 방지: 동일 크리에이터+캠페인에 이미 제출된 증빙이 있으면 차단
    const alreadyDelivered = db.campaign_deliveries.some(
      (d) => d.campaign_id === campaignId && d.creator_id === user.id
    );
    if (alreadyDelivered) return;
    db.campaign_deliveries.push({
      id: genId(),
      campaign_id: campaignId,
      creator_id: user.id,
      platform,
      post_url: postUrl,
      proof_image_url: proofImageUrl || null,
      submitted_video_url: submittedVideoUrl || null,
      description: description || null,
      status: "submitted",
      reward_amount: 0,
      created_at: now(),
      updated_at: now(),
    });
    if (c.status === "in_progress") {
      c.status = "submitted";
      c.updated_at = now();
    }
  });
  revalidatePath("/creator/campaigns");
}

// === ADMIN/ADVERTISER: 증빙 승인 -> CREATOR 수익 정산 =================
export async function reviewCampaignProofAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "advertiser")) return;
  const deliveryId = String(fd.get("delivery_id") || "");
  const decision = String(fd.get("decision") || ""); // approve | reject
  tx((db) => {
    const del = db.campaign_deliveries.find((d) => d.id === deliveryId);
    if (!del || del.status !== "submitted") return;
    const c = db.ad_campaigns.find((x) => x.id === del.campaign_id);
    if (!c) return;
    if (user.role === "advertiser" && c.advertiser_id !== user.id) return;

    if (decision === "approve") {
      const rate = db.settings.distribution_rates.find((r) => r.platform === del.platform);
      const reward =
        (rate?.creator_payout ?? 0) + (c.video_required ? db.settings.extra_creation_creator_payout : 0);
      del.status = "approved";
      del.reward_amount = reward;
      del.updated_at = now();
      addWalletTxOnce(db, {
        userId: del.creator_id,
        type: "campaign_reward",
        amount: reward,
        status: "available",
        relatedTable: "campaign_deliveries",
        relatedId: del.id,
        memo: `캠페인 배포 수익: ${c.title}`,
      });
      audit(db, { actorId: user.id, action: "approve_proof", targetTable: "campaign_deliveries", targetId: del.id });
    } else {
      del.status = "rejected";
      del.updated_at = now();
    }
  });
  revalidatePath("/advertiser/campaigns");
  revalidatePath("/admin/campaigns");
}

// === ADMIN: 캠페인 완료 처리 (campaign_completed 기준 수수료 생성) =====
export async function completeCampaignAction(fd: FormData): Promise<void> {
  const user = requireRole("admin");
  const id = String(fd.get("id") || "");
  tx((db) => {
    const c = db.ad_campaigns.find((x) => x.id === id);
    // 진행 중인 캠페인만 완료 처리 허용 (환불·반려·취소·완료된 캠페인 차단)
    if (!c || !["recruiting", "published", "in_progress", "submitted"].includes(c.status)) return;
    c.status = "completed";
    c.updated_at = now();
    if (db.settings.advertiser_commission_basis === "campaign_completed") {
      createAdvertiserCommission(db, {
        agencyId: c.advertiser_id,
        baseAmount: c.total_cost,
        campaignId: c.id,
        memo: `캠페인 완료 금액 기준 수수료: ${c.title}`,
      });
    }
    audit(db, { actorId: user.id, action: "complete_campaign", targetTable: "ad_campaigns", targetId: id });
  });
  revalidatePath("/admin/campaigns");
}

// === ADMIN: 캠페인 승인 (단독 액션) ====================================
export async function approveCampaignAction(fd: FormData): Promise<void> {
  fd.set("decision", "publish");
  await reviewCampaignAction(fd);
}

// === ADMIN: 캠페인 반려 (단독 액션) ====================================
export async function rejectCampaignAction(fd: FormData): Promise<void> {
  fd.set("decision", "reject");
  await reviewCampaignAction(fd);
}

// === CREATOR: 참여 신청 (participation_type 포함) =======================
export async function joinParticipationAction(fd: FormData): Promise<ActionState> {
  const user = requireRole("creator");
  const campaignId = String(fd.get("campaign_id") || "");
  const participationType = String(fd.get("participation_type") || "deploy") as "deploy" | "video_production";

  let outcome: ActionState = { ok: false };
  tx((db) => {
    const campaign = db.ad_campaigns.find((c) => c.id === campaignId);
    if (!campaign || !["recruiting", "published", "in_progress"].includes(campaign.status)) {
      outcome = { ok: false, message: "참여 불가능한 캠페인입니다." };
      return;
    }
    if (campaign.end_date && new Date(campaign.end_date).getTime() < Date.now()) {
      outcome = { ok: false, message: "참여 모집 기한이 종료되었습니다." };
      return;
    }
    const eligibility = campaignEligibility(db, user, campaign);
    if (!eligibility.eligible) {
      outcome = { ok: false, message: eligibility.reasons.join(" ") };
      return;
    }
    const capacity = participationCapacity(db, campaign, participationType);
    if (capacity.full) {
      outcome = { ok: false, message: `${participationType === "deploy" ? "배포" : "영상 제작"} 모집이 마감되었습니다.` };
      return;
    }
    const already = (db.campaign_participations ?? []).find(
      (p) =>
        p.campaign_id === campaignId &&
        p.creator_id === user.id &&
        (p.participation_type ?? "deploy") === participationType
    );
    if (already) {
      outcome = { ok: false, message: "이미 해당 유형으로 참여 신청했습니다." };
      return;
    }
    if (!db.campaign_participations) db.campaign_participations = [];

    const isDeployPool = participationType === "deploy" && hasVideoPool(campaign);
    if (isDeployPool && !isDistributionUnlocked(db, campaign)) {
      outcome = { ok: false, message: "아직 영상 제작·승인이 완료되지 않아 배포를 신청할 수 없습니다." };
      return;
    }

    const pid = genId();
    const participation = {
      id: pid,
      campaign_id: campaignId,
      creator_id: user.id,
      status: (isDeployPool ? "accepted" : "applied") as "accepted" | "applied",
      participation_type: participationType,
      applied_at: now(),
      updated_at: now(),
    };

    if (isDeployPool) {
      const alloc = allocateVideoForParticipation(db, campaign, user.id, pid);
      if (!alloc.ok) {
        outcome = {
          ok: false,
          message: alloc.reason === "exhausted"
            ? "배포 가능한 영상이 모두 소진되었습니다."
            : "아직 영상 제작·승인이 완료되지 않아 배포를 신청할 수 없습니다.",
        };
        return;
      }
    }

    db.campaign_participations.push(participation);
    notifyUser(db, { recipientId: campaign.advertiser_id, title: "새 캠페인 참여 신청", message: campaign.title, link: `/advertiser/campaigns/${campaign.id}` });
    audit(db, { actorId: user.id, action: "join_participation", targetTable: "campaign_participations", targetId: campaignId });
    outcome = { ok: true, message: "참여 신청이 완료되었습니다." };
  });
  revalidatePath("/creator/campaigns");
  return outcome;
}

// === ADVERTISER/ADMIN: 참여 다단계 승인/반려 ============================
export async function reviewParticipationAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "advertiser")) return;
  const participationId = String(fd.get("participation_id") || "");
  const decision = String(fd.get("decision") || ""); // approve | reject
  const reason = String(fd.get("reason") || "");
  tx((db) => {
    const p = (db.campaign_participations ?? []).find((x) => x.id === participationId);
    if (!p) return;
    const campaign = db.ad_campaigns.find((c) => c.id === p.campaign_id);
    if (!campaign) return;
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) return;

    const ptype = p.participation_type ?? "deploy";

    if (p.status === "applied") {
      // 단계 1: 크리에이터 선발 승인/반려
      if (decision === "approve") {
        p.status = "accepted";
      } else if (decision === "reject") {
        // 선발 반려: application_rejected (video_rejected/deploy_rejected는 재제출 허용 상태이므로 구분)
        p.status = "application_rejected";
        p.rejection_reason = reason || "선발되지 않았습니다.";
      }
    } else if (p.status === "video_submitted") {
      // 단계 3 (영상제작): 제출된 영상 승인/반려
      if (decision === "approve") {
        p.status = "completed";
        // 제작·승인된 영상을 배포 풀(campaign_videos)에 추가
        syncCampaignVideos(db, campaign);
        const reward = creatorVideoPayout(db, campaign.video_duration_tier);
        addWalletTxOnce(db, { userId: p.creator_id, type: "campaign_reward", amount: reward, status: "available", relatedTable: "campaign_participations", relatedId: p.id, memo: `영상제작 완료 수익: ${campaign.title}` });
      }
      else if (decision === "reject") { p.status = "video_rejected"; p.rejection_reason = reason || "반려 처리되었습니다."; }
    } else if (p.status === "deploy_submitted") {
      if (decision === "approve") {
        // 정책설정의 플랫폼별 크리에이터 배포 지급액(평균) 적립
        const reward = creatorDeployPayout(db, campaign.platforms);
        addWalletTxOnce(db, { userId: p.creator_id, type: "campaign_reward", amount: reward, status: "available", relatedTable: "campaign_participations", relatedId: p.id, memo: `배포 완료 수익: ${campaign.title}` });
        // 분배받은 영상을 배포완료 처리
        markVideoDistributed(db, p.id);
        p.status = "completed";
      } else if (decision === "reject") { p.status = "deploy_rejected"; p.rejection_reason = reason || "배포가 반려되었습니다."; }
    } else if (p.status === "video_approved") {
      if (decision === "approve") {
        // 정책설정의 영상 길이 구간별 크리에이터 제작 단가 적립
        const reward = creatorVideoPayout(db, campaign.video_duration_tier);
        addWalletTxOnce(db, { userId: p.creator_id, type: "campaign_reward", amount: reward, status: "available", relatedTable: "campaign_participations", relatedId: p.id, memo: `영상제작 완료 수익: ${campaign.title}` });
        p.status = "completed";
      }
    }
    p.updated_at = now();
    // 관리자가 처리한 경우에만 광고주에게 알림 (광고주 본인이 처리 시 자기 알림 제외)
    if (user.role === "admin") {
      notifyUser(db, {
        recipientId: campaign.advertiser_id,
        title: decision === "approve" ? "캠페인 작업이 승인되었습니다" : "캠페인 작업이 반려되었습니다",
        message: `${campaign.title} · ${ptype === "deploy" ? "배포" : "영상 제작"}`,
        link: `/advertiser/campaigns/${campaign.id}`,
      });
    }
    notifyUser(db, {
      recipientId: p.creator_id,
      title: decision === "approve" ? "캠페인 참여/작업이 승인되었습니다" : "캠페인 참여/작업이 반려되었습니다",
      message: `${campaign.title} · 현재 상태: ${p.status}${p.rejection_reason ? ` · ${p.rejection_reason}` : ""}`,
      link: "/creator/campaigns",
    });
    audit(db, { actorId: user.id, action: `participation_${decision}_${p.status}`, targetTable: "campaign_participations", targetId: participationId });
  });
  revalidatePath("/advertiser/campaigns");
  revalidatePath("/admin/campaigns");
  revalidatePath("/creator/campaigns");
}

export async function resolveParticipationDisputeAction(fd: FormData): Promise<void> {
  const admin = requireRole("admin");
  const participationId = String(fd.get("participation_id") || "");
  const decision = String(fd.get("decision") || "");
  tx((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === participationId && item.status === "disputed");
    if (!participation || !["restore", "complete", "cancel"].includes(decision)) return;
    const campaign = db.ad_campaigns.find((item) => item.id === participation.campaign_id);
    if (!campaign) return;
    if (decision === "restore") participation.status = participation.dispute_previous_status ?? "accepted";
    if (decision === "cancel") {
      const paidReward = db.wallet_transactions.some((item) => item.related_table === "campaign_participations" && item.related_id === participation.id && item.status !== "cancelled");
      if (paidReward) return;
      participation.status = "cancelled";
    }
    if (decision === "complete") {
      participation.status = "completed";
      const isVideo = (participation.participation_type ?? "deploy") === "video_production";
      if (isVideo) syncCampaignVideos(db, campaign); else markVideoDistributed(db, participation.id);
      addWalletTxOnce(db, { userId: participation.creator_id, type: "campaign_reward", amount: isVideo ? creatorVideoPayout(db, campaign.video_duration_tier) : creatorDeployPayout(db, campaign.platforms), status: "available", relatedTable: "campaign_participations", relatedId: participation.id, memo: `분쟁 조정 완료 수익: ${campaign.title}` });
    }
    participation.dispute_previous_status = undefined;
    participation.updated_at = now();
    notifyUser(db, { recipientId: participation.creator_id, title: "캠페인 분쟁 처리가 완료되었습니다", message: `${campaign.title} · ${participation.status}`, link: "/creator/campaigns" });
    notifyUser(db, { recipientId: campaign.advertiser_id, title: "캠페인 분쟁 처리가 완료되었습니다", message: `${campaign.title} · ${participation.status}`, link: `/advertiser/campaigns/${campaign.id}` });
    audit(db, { actorId: admin.id, action: `resolve_participation_dispute_${decision}`, targetTable: "campaign_participations", targetId: participation.id });
  });
  revalidatePath("/admin/campaigns");
}

export async function submitParticipationWorkAction(fd: FormData): Promise<ActionState> {
  const user = requireRole("creator");
  const participationId = String(fd.get("participation_id") || "");
  const deployLink = String(fd.get("deploy_link") || "");
  const videoUrl = String(fd.get("video_url") || "");
  const note = String(fd.get("note") || "");
  let outcome: ActionState = { ok: false };
  tx((db) => {
    const p = (db.campaign_participations ?? []).find((x) => x.id === participationId && x.creator_id === user.id);
    if (!p) { outcome = { ok: false, message: "참여 기록을 찾을 수 없습니다." }; return; }
    const campaign = db.ad_campaigns.find((x) => x.id === p.campaign_id);
    if (!campaign || !["recruiting", "published", "in_progress"].includes(campaign.status)) {
      outcome = { ok: false, message: "진행 중인 캠페인만 제출할 수 있습니다." }; return;
    }
    if (campaign.end_date && new Date(campaign.end_date).getTime() < Date.now()) {
      outcome = { ok: false, message: "제출 기한이 종료되었습니다." }; return;
    }
    const ptype = p.participation_type ?? "deploy";
    if (ptype === "deploy") {
      if (!["accepted", "deploy_rejected"].includes(p.status)) { outcome = { ok: false, message: "제출할 수 없는 상태입니다." }; return; }
      if (!isHttpUrl(deployLink)) { outcome = { ok: false, message: "유효한 배포 URL을 입력해주세요." }; return; }
      p.deploy_link = deployLink; p.deploy_note = note || undefined; p.status = "deploy_submitted"; p.rejection_reason = undefined;
    } else {
      if (!["accepted", "video_rejected"].includes(p.status)) { outcome = { ok: false, message: "제출할 수 없는 상태입니다." }; return; }
      if (!isHttpUrl(videoUrl)) { outcome = { ok: false, message: "유효한 영상 URL을 입력해주세요." }; return; }
      p.video_url = videoUrl; p.video_note = note || undefined; p.status = "video_submitted"; p.rejection_reason = undefined;
    }
    p.updated_at = now();
    audit(db, { actorId: user.id, action: "submit_work", targetTable: "campaign_participations", targetId: participationId });
    outcome = { ok: true, message: "제출이 완료되었습니다. 검토를 기다려 주세요." };
  });
  revalidatePath("/creator/campaigns");
  return outcome;
}
