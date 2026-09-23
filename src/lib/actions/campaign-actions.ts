"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, tx } from "../db";
import { isHttpUrl } from "../url";
import { requireRole, getCurrentUser } from "../auth";
import { genId } from "../crypto";
import {
  addPointTx,
  addPointTxOnce,
  addWalletTxOnce,
  audit,
  ensurePointWallet,
  notifyUser,
} from "../services";
import { computeCampaignCost } from "../queries";
import {
  cancelCampaign,
  cancelLegacyWalletCommissions,
  openDispute,
  joinParticipation,
  maybeAutoCompleteCampaign,
  notifyAdmins,
  onCampaignPublished,
  resolveDispute,
  reviewParticipation,
  settleCampaign,
  submitParticipationWork,
  type ParticipationType,
} from "../campaign-workflow";
import { ALL_SOCIAL_PLATFORMS, type AdCampaign, type CampaignType, type SocialPlatform } from "../schema";
import type { ActionState } from "@/components/form";

const now = () => new Date().toISOString();


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
    if (val !== null && val !== "") {
      const n = Math.floor(Number(val));
      platformDistributions[p] = Number.isFinite(n) ? Math.max(0, n) : 0;
    }
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
  // URL 입력값은 http(s) 만 허용 (javascript: 등 차단)
  if (d.website_url && !isHttpUrl(d.website_url)) {
    return { ok: false, message: "공식 웹사이트 URL은 http(s):// 로 시작해야 합니다.", fieldErrors: { website_url: "http(s) 주소를 입력하세요." } };
  }
  if (d.utm_link && !isHttpUrl(d.utm_link)) {
    return { ok: false, message: "UTM 링크는 http(s):// 로 시작해야 합니다." };
  }
  if (d.uploaded_video_url && !isHttpUrl(d.uploaded_video_url)) {
    return { ok: false, message: "영상 URL은 http(s):// 로 시작해야 합니다." };
  }
  // 영상 길이 구간은 관리자 설정에 존재하고 단가가 정해진 구간만 허용 (custom 등 0원 구간 차단)
  if (videoRequired) {
    const tierKey = d.video_duration_tier ?? "";
    const tier = (getDb().settings.video_pricing_tiers ?? []).find((t) => t.key === tierKey);
    if (!tier || tier.max_seconds === null || tier.max_seconds === undefined || !(tier.advertiser_charge > 0)) {
      return { ok: false, message: "영상 길이 구간을 선택하세요." };
    }
  }
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
  // 단순 제작(배포 없음)은 플랫폼별 배포 건수를 무시한다
  if (ctype === "create_only") for (const key of Object.keys(platformDistributions)) delete platformDistributions[key as SocialPlatform];
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
      if (url && !isHttpUrl(url)) {
        return { ok: false, message: `배포 영상 ${i + 1}의 URL은 http(s):// 로 시작해야 합니다.` };
      }
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

    // 실행사 수수료는 관리자 승인(노출) 시점에 적립한다 (반려 시 회수 불필요) → onCampaignPublished

    // 관리자에게 승인 요청 알림
    notifyAdmins(db, {
      title: "새 캠페인 승인 요청",
      message: `${campaign.title} · ${cost.toLocaleString()}P`,
      link: "/admin/campaigns",
    });
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
  const memo = String(fd.get("admin_memo") || "").trim();
  if (decision !== "publish" && decision !== "reject") return;
  tx((db) => {
    const c = db.ad_campaigns.find((x) => x.id === id);
    if (!c || c.status !== "admin_review") return;
    if (decision === "publish") {
      c.status = "recruiting";
      c.approved_at = now();
      c.published_at = now();
      c.admin_memo = memo || null;
      // 실행사 수수료 (대행사 광고 주문 차감액 기준)
      onCampaignPublished(db, c);
      notifyUser(db, {
        recipientId: c.advertiser_id,
        title: "캠페인이 승인되어 모집을 시작했습니다",
        message: `${c.title}${memo ? ` · 관리자 메모: ${memo}` : ""}`,
        link: `/advertiser/campaigns/${c.id}`,
        category: "campaign_status",
      });
    } else {
      c.status = "rejected";
      c.admin_memo = memo || null;
      // 포인트 환불 (중복 환불 방지)
      addPointTxOnce(db, {
        advertiserId: c.advertiser_id,
        type: "refund",
        amount: c.point_spent,
        campaignId: c.id,
        memo: `캠페인 반려 환불: ${c.title}`,
      });
      // 구버전 코드가 등록 시점에 만든 실행사 수수료(수익지갑)를 잔액과 함께 취소
      cancelLegacyWalletCommissions(db, c.id);
      notifyUser(db, {
        recipientId: c.advertiser_id,
        title: "캠페인이 반려되었습니다 (포인트 환불)",
        message: `${c.title}${memo ? ` · 사유: ${memo}` : ""} · ${c.point_spent.toLocaleString()}P 환불`,
        link: `/advertiser/campaigns/${c.id}`,
        category: "campaign_status",
      });
    }
    c.updated_at = now();
    audit(db, { actorId: user.id, action: `campaign_${decision}`, targetTable: "ad_campaigns", targetId: id });
  });
  revalidatePath("/admin/campaigns");
  revalidatePath("/advertiser/campaigns");
}

// === CREATOR: (구버전) 캠페인 참여 신청 — 신규 참여는 joinParticipation 흐름만 사용 ===
// 구버전(campaign_applications) 흐름은 신규 참여(campaign_participations)와 이중 지급 위험이 있어 신규 신청을 막는다.
export async function applyCampaignAction(_fd: FormData): Promise<void> {
  requireRole("creator");
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

// === CREATOR: (구버전) 배포 증빙 제출 — 비활성화 ================================
// 신규 제출은 참여(campaign_participations) 흐름의 작업물 제출만 허용한다.
// (구버전 제출은 캠페인 상태를 submitted 로 바꿔 신규 참여자 제출을 막고, 이중 지급을 유발했음)
export async function submitCampaignProofAction(_fd: FormData): Promise<void> {
  requireRole("creator");
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
      // 신규 참여 흐름으로 같은 캠페인 배포 수익을 이미 받았거나 검토 중이면 이중 지급 방지
      const newFlow = (db.campaign_participations ?? []).some(
        (p) => p.campaign_id === c.id && p.creator_id === del.creator_id && (p.participation_type ?? "deploy") === "deploy" &&
          !["cancelled", "application_rejected"].includes(p.status)
      );
      if (newFlow) return;
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
      maybeAutoCompleteCampaign(db, c, user.id);
    } else {
      del.status = "rejected";
      del.updated_at = now();
    }
  });
  revalidatePath("/advertiser/campaigns");
  revalidatePath("/admin/campaigns");
}

// === ADMIN: 캠페인 완료(정산) 처리 — 완료분만 소진, 미집행분 환불 =====
export async function completeCampaignAction(fd: FormData): Promise<void> {
  const user = requireRole("admin");
  const id = String(fd.get("id") || "");
  const result = tx((db) => settleCampaign(db, user.id, id));
  revalidatePath("/admin/campaigns");
  revalidatePath("/advertiser/campaigns");
  redirect(`/admin/campaigns?${noticeQuery(result)}`);
}

// === ADMIN: 캠페인 취소(전액 환불) ======================================
export async function adminCancelCampaignAction(fd: FormData): Promise<void> {
  const user = requireRole("admin");
  const id = String(fd.get("id") || "");
  const result = tx((db) => cancelCampaign(db, user, id));
  revalidatePath("/admin/campaigns");
  revalidatePath("/advertiser/campaigns");
  redirect(`/admin/campaigns?${noticeQuery(result)}`);
}

function noticeQuery(result: { ok: boolean; message?: string; error?: string }): string {
  const text = result.ok ? result.message ?? "처리되었습니다." : result.error ?? "처리하지 못했습니다.";
  return new URLSearchParams({ notice: text, tone: result.ok ? "ok" : "error" }).toString();
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
  const participationType = String(fd.get("participation_type") || "deploy") as ParticipationType;
  const result = tx((db) => joinParticipation(db, user, campaignId, participationType));
  revalidatePath("/creator/campaigns");
  return result.ok ? { ok: true, message: result.message } : { ok: false, message: result.error };
}

// === ADVERTISER/ADMIN: 참여 다단계 승인/반려 ============================
export async function reviewParticipationAction(fd: FormData): Promise<void> {
  const user = getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "advertiser") || user.status !== "active") return;
  const participationId = String(fd.get("participation_id") || "");
  const decision = String(fd.get("decision") || ""); // approve | reject
  const reason = String(fd.get("reason") || "");
  if (decision !== "approve" && decision !== "reject") return;
  let campaignId = "";
  const result = tx((db) => {
    const p = (db.campaign_participations ?? []).find((x) => x.id === participationId);
    if (!p) return { ok: false as const, status: 404, error: "참여 기록을 찾을 수 없습니다." };
    campaignId = p.campaign_id;
    return reviewParticipation(db, user, p, decision, reason);
  });
  revalidatePath("/advertiser/campaigns");
  revalidatePath("/admin/campaigns");
  revalidatePath("/creator/campaigns");
  // 처리 결과(성공/실패 사유)를 화면에 보여주기 위해 쿼리로 전달
  if (user.role === "admin") redirect(`/admin/campaigns?${noticeQuery(result)}`);
  if (campaignId) redirect(`/advertiser/campaigns/${campaignId}?${noticeQuery(result)}`);
}

export async function resolveParticipationDisputeAction(fd: FormData): Promise<void> {
  const admin = requireRole("admin");
  const participationId = String(fd.get("participation_id") || "");
  const decision = String(fd.get("decision") || "") as "restore" | "complete" | "cancel";
  const result = tx((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === participationId);
    if (!participation) return { ok: false as const, status: 404, error: "처리할 분쟁을 찾을 수 없습니다." };
    return resolveDispute(db, admin, participation, decision);
  });
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns?${noticeQuery(result)}`);
}

export async function submitParticipationWorkAction(fd: FormData): Promise<ActionState> {
  const user = requireRole("creator");
  const participationId = String(fd.get("participation_id") || "");
  const deployLink = String(fd.get("deploy_link") || "");
  const videoUrl = String(fd.get("video_url") || "");
  const note = String(fd.get("note") || "");
  const result = tx((db) => {
    const p = (db.campaign_participations ?? []).find((x) => x.id === participationId && x.creator_id === user.id);
    if (!p) return { ok: false as const, status: 404, error: "참여 기록을 찾을 수 없습니다." };
    const url = (p.participation_type ?? "deploy") === "deploy" ? deployLink : videoUrl;
    return submitParticipationWork(db, user, p, { url, note });
  });
  revalidatePath("/creator/campaigns");
  return result.ok ? { ok: true, message: result.message } : { ok: false, message: result.error };
}

// === ADVERTISER: 참여 건 분쟁 신청 (광고주 캠페인 상세 화면) =================
export async function openDisputeAction(fd: FormData): Promise<void> {
  const user = requireRole("advertiser", "admin");
  const participationId = String(fd.get("participation_id") || "");
  const reason = String(fd.get("reason") || "");
  let campaignId = "";
  const result = tx((db) => {
    const participation = (db.campaign_participations ?? []).find((item) => item.id === participationId);
    if (!participation) return { ok: false as const, status: 404, error: "참여 기록을 찾을 수 없습니다." };
    campaignId = participation.campaign_id;
    return openDispute(db, user, participation, reason);
  });
  revalidatePath("/admin/campaigns");
  if (user.role === "admin" || !campaignId) redirect(`/admin/campaigns?${noticeQuery(result)}`);
  redirect(`/advertiser/campaigns/${campaignId}?${noticeQuery(result)}`);
}
