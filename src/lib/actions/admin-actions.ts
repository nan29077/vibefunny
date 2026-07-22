"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireAdmin } from "../auth";
import { genId } from "../crypto";
import { audit, makeWalletTxAvailable } from "../services";
import type { CommissionBasis, Platform, Role, UserStatus } from "../schema";

const now = () => new Date().toISOString();
const num = (fd: FormData, k: string) => Math.max(0, Math.floor(Number(fd.get(k) || 0)));
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";

// === 4.1/4.2 구독료·추천수당 설정 (광고주 가입비 제외) ==================
export async function updateFeesAction(fd: FormData): Promise<void> {
  requireAdmin();
  const roles: Role[] = ["creator", "advertiser"];
  tx((db) => {
    for (const role of roles) {
      const f = db.settings.fees[role];
      // 광고주는 가입비 항목 미사용
      if (role === "creator") {
        f.signup_fee_enabled = bool(fd, `${role}_signup_enabled`);
        f.signup_fee_amount = num(fd, `${role}_signup_amount`);
        f.subscription_enabled = bool(fd, `${role}_sub_enabled`);
        f.subscription_amount = num(fd, `${role}_sub_amount`);
      }
      f.referral_reward_amount = num(fd, `${role}_referral_amount`);
    }
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_fees", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.3 영상 제작 단가 ================================================
export async function updateVideoPricingAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.video_pricing_tiers = db.settings.video_pricing_tiers.map((t) => ({
      ...t,
      amount: num(fd, `tier_${t.key}`),
      advertiser_charge: num(fd, `tier_${t.key}_charge`),
    }));
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_video_pricing", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.4 영상 판매 수수료 ==============================================
export async function updateVideoSaleAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.video_sale_platform_fee_rate = num(fd, "platform_fee_rate");
    db.settings.video_auto_approve = bool(fd, "video_auto_approve");
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_video_sale", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.5 배포 단가 ====================================================
export async function updateDistributionAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.distribution_rates = db.settings.distribution_rates.map((r) => ({
      ...r,
      creator_payout: num(fd, `${r.platform}_payout`),
      advertiser_charge: num(fd, `${r.platform}_charge`),
    }));
    db.settings.extra_creation_creator_payout = num(fd, "extra_creation_creator_payout");
    db.settings.extra_creation_advertiser_charge = num(fd, "extra_creation_advertiser_charge");
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_distribution", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.6 광고주 수직 수수료 ===========================================
export async function updateAdvertiserCommissionAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.advertiser_commission_rate = num(fd, "commission_rate");
    db.settings.advertiser_commission_basis = String(
      fd.get("commission_basis") || "agency_spend"
    ) as CommissionBasis;
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_advertiser_commission", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 카테고리 관리 ====================================================
export async function addCategoryAction(fd: FormData): Promise<void> {
  requireAdmin();
  const platform = String(fd.get("platform") || "youtube") as Platform;
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  tx((db) => {
    db.categories.push({
      id: genId(),
      platform,
      name,
      slug: `${platform}-${Date.now()}`,
      parent_id: null,
      sort_order: db.categories.filter((c) => c.platform === platform).length,
      is_active: true,
    });
    audit(db, { actorId: null, action: "add_category", targetTable: "categories" });
  });
  revalidatePath("/admin/categories");
}

export async function toggleCategoryAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  tx((db) => {
    const c = db.categories.find((x) => x.id === id);
    if (c) c.is_active = !c.is_active;
  });
  revalidatePath("/admin/categories");
}

// === 회원 상태 변경 ===================================================
export async function setMemberStatusAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  const status = String(fd.get("status") || "active") as UserStatus;
  tx((db) => {
    const u = db.profiles.find((x) => x.id === id);
    if (!u || u.role === "admin") return;
    const before = u.status;
    u.status = status;
    u.updated_at = now();
    audit(db, {
      actorId: null,
      action: "set_member_status",
      targetTable: "profiles",
      targetId: id,
      before: { status: before },
      after: { status },
    });
  });
  revalidatePath("/admin/members");
}

// === 영상 판매 승인/반려 ==============================================
export async function approveVideoAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  const approve = fd.get("approve") === "1";
  tx((db) => {
    const v = db.videos.find((x) => x.id === id);
    if (!v || v.status !== "pending_review") return;
    v.status = approve ? "available" : "rejected";
    v.updated_at = now();
    audit(db, {
      actorId: null,
      action: approve ? "approve_video" : "reject_video",
      targetTable: "videos",
      targetId: id,
    });
  });
  revalidatePath("/admin/videos");
}

// === 추천 수당 지급가능 처리 (pending -> available) ===================
export async function releaseWalletTxAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  tx((db) => {
    makeWalletTxAvailable(db, id);
    audit(db, { actorId: null, action: "release_wallet_tx", targetTable: "wallet_transactions", targetId: id });
  });
  revalidatePath("/admin/payouts");
}

// === 출금 신청 처리 ===================================================
export async function processPayoutAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  const decision = String(fd.get("decision") || ""); // approve | reject | paid
  tx((db) => {
    const pr = db.payout_requests.find((x) => x.id === id);
    if (!pr) return;
    if (decision === "approve" && pr.status === "requested") {
      pr.status = "approved";
    } else if (decision === "reject" && (pr.status === "requested" || pr.status === "approved")) {
      pr.status = "rejected";
      // 반려 시 묶었던 금액을 available 로 환원
      const w = db.wallets.find((x) => x.user_id === pr.user_id);
      if (w) w.available_balance += pr.amount;
      // 관련 출금 거래 취소
      db.wallet_transactions
        .filter((t) => t.related_id === pr.id && t.type === "payout")
        .forEach((t) => (t.status = "cancelled"));
    } else if (decision === "paid" && pr.status === "approved") {
      pr.status = "paid";
      pr.processed_at = now();
      const w = db.wallets.find((x) => x.user_id === pr.user_id);
      if (w) w.paid_balance += pr.amount;
      db.wallet_transactions
        .filter((t) => t.related_id === pr.id && t.type === "payout")
        .forEach((t) => (t.status = "paid"));
    }
    audit(db, {
      actorId: null,
      action: `payout_${decision}`,
      targetTable: "payout_requests",
      targetId: id,
    });
  });
  revalidatePath("/admin/payouts");
}

// === 추천인 제도 ON/OFF + 유료 부업 ======================================
export async function updateReferralSystemAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.referral_system_enabled = bool(fd, "referral_system_enabled");
    db.settings.is_paid_model = bool(fd, "is_paid_model");
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_referral_system", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 유료 부업 정책 설정 ================================================
export async function updatePolicyAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.is_paid_model = bool(fd, "is_paid_model");
    db.settings.referral_bonus = num(fd, "referral_bonus");
    db.settings.referral_system_enabled = bool(fd, "referral_system_enabled");
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_policy", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/referrals");
}

// === 추천인 수당 지급 처리 (PENDING → PAID) ============================
export async function payReferralRewardAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  tx((db) => {
    const reward = db.referral_rewards.find((r) => r.id === id);
    if (!reward || reward.status !== "PENDING") return;
    reward.status = "PAID";
    reward.paid_at = now();
    // 연관 wallet_tx를 available로 전환
    if (reward.wallet_tx_id) {
      makeWalletTxAvailable(db, reward.wallet_tx_id);
    }
    audit(db, {
      actorId: null,
      action: "pay_referral_reward",
      targetTable: "referral_rewards",
      targetId: id,
    });
  });
  revalidatePath("/admin/referrals");
}

// === 추천인 수당 취소 (PENDING → CANCELLED) ============================
export async function cancelReferralRewardAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") || "");
  tx((db) => {
    const reward = db.referral_rewards.find((r) => r.id === id);
    if (!reward || reward.status !== "PENDING") return;
    reward.status = "CANCELLED";
    // 연관 wallet_tx 취소
    if (reward.wallet_tx_id) {
      const wtx = db.wallet_transactions.find((t) => t.id === reward.wallet_tx_id);
      if (wtx && wtx.status === "pending") {
        const w = db.wallets.find((x) => x.user_id === wtx.user_id);
        if (w) w.pending_balance -= wtx.amount;
        wtx.status = "cancelled";
        wtx.updated_at = now();
      }
    }
    audit(db, {
      actorId: null,
      action: "cancel_referral_reward",
      targetTable: "settings",
      targetId: id,
    });
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/referrals");
}


// === 회원 영상판매 가격 구간 설정 (바이브포터) ===========================
export async function updateMemberVideoSalePriceTiersAction(fd: FormData): Promise<void> {
  requireAdmin();
  tx((db) => {
    db.settings.member_video_sale_price_tiers = db.settings.member_video_sale_price_tiers.map((t) => ({
      ...t,
      price: Math.max(0, Math.floor(Number(fd.get(`tier_${t.key}_price`) || t.price))),
      creator_payout: Math.max(0, Math.floor(Number(fd.get(`tier_${t.key}_creator`) ?? t.creator_payout ?? 0))),
    }));
    db.settings.updated_at = now();
    audit(db, { actorId: null, action: "update_settings", targetTable: "settings", targetId: "member_video_sale_price_tiers" });
  });
  revalidatePath("/admin/settings");
}
