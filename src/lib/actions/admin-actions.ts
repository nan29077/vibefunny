"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireAdmin } from "../auth";
import { genId } from "../crypto";
import { audit, makeWalletTxAvailable, notifyUser } from "../services";
import type { CommissionBasis, Platform, Role, UserStatus } from "../schema";

const now = () => new Date().toISOString();
const num = (fd: FormData, k: string) => {
  const v = Math.floor(Number(fd.get(k) || 0));
  return Number.isFinite(v) ? Math.max(0, v) : 0; // NaN/Infinity 입력 방지
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";

// === 4.1/4.2 구독료·추천수당 설정 (광고주 가입비 제외) ==================
export async function updateFeesAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const roles: Role[] = ["creator", "advertiser"];
  tx((db) => {
    for (const role of roles) {
      // 화면에 그 역할의 입력칸이 없으면 기존 값을 그대로 둔다 (빈 값이 0원으로 저장되던 문제 방지)
      if (!fd.has(`${role}_referral_amount`)) continue;
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
    audit(db, { actorId: admin.id, action: "update_fees", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.3 영상 제작 단가 ================================================
export async function updateVideoPricingAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.video_pricing_tiers = db.settings.video_pricing_tiers.map((t) => ({
      ...t,
      amount: num(fd, `tier_${t.key}`),
      advertiser_charge: num(fd, `tier_${t.key}_charge`),
    }));
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_video_pricing", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.4 영상 판매 수수료 ==============================================
export async function updateVideoSaleAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.video_sale_platform_fee_rate = Math.min(100, num(fd, "platform_fee_rate")); // 수수료율 0~100%
    db.settings.video_auto_approve = bool(fd, "video_auto_approve");
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_video_sale", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.5 배포 단가 ====================================================
export async function updateDistributionAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.distribution_rates = db.settings.distribution_rates.map((r) => ({
      ...r,
      creator_payout: num(fd, `${r.platform}_payout`),
      advertiser_charge: num(fd, `${r.platform}_charge`),
    }));
    db.settings.extra_creation_creator_payout = num(fd, "extra_creation_creator_payout");
    db.settings.extra_creation_advertiser_charge = num(fd, "extra_creation_advertiser_charge");
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_distribution", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 4.6 광고주 수직 수수료 ===========================================
export async function updateAdvertiserCommissionAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.advertiser_commission_rate = Math.min(100, num(fd, "commission_rate")); // 수수료율 0~100%
    db.settings.advertiser_commission_basis = String(
      fd.get("commission_basis") || "agency_spend"
    ) as CommissionBasis;
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_advertiser_commission", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 카테고리 관리 ====================================================
export async function addCategoryAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
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
    audit(db, { actorId: admin.id, action: "add_category", targetTable: "categories" });
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
  const admin = requireAdmin();
  const id = String(fd.get("id") || "");
  const status = String(fd.get("status") || "active") as UserStatus;
  tx((db) => {
    const u = db.profiles.find((x) => x.id === id);
    if (!u || u.role === "admin") return;
    const before = u.status;
    u.status = status;
    u.updated_at = now();
    audit(db, {
      actorId: admin.id,
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
  const admin = requireAdmin();
  const id = String(fd.get("id") || "");
  const approve = fd.get("approve") === "1";
  tx((db) => {
    const v = db.videos.find((x) => x.id === id);
    if (!v || v.status !== "pending_review") return;
    v.status = approve ? "available" : "rejected";
    v.updated_at = now();
    audit(db, {
      actorId: admin.id,
      action: approve ? "approve_video" : "reject_video",
      targetTable: "videos",
      targetId: id,
    });
  });
  revalidatePath("/admin/videos");
}

// === 추천 수당 지급가능 처리 (pending -> available) ===================
export async function releaseWalletTxAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const id = String(fd.get("id") || "");
  tx((db) => {
    const txn = db.wallet_transactions.find((t) => t.id === id);
    if (!txn || txn.status !== "pending") return;
    makeWalletTxAvailable(db, id);
    // 추천 수당이면 추천 수당 레코드도 함께 지급 처리 (두 화면의 상태 불일치 방지)
    if (txn.type === "signup_referral") {
      const reward = db.referral_rewards.find((r) => r.wallet_tx_id === id);
      if (reward && reward.status === "PENDING") {
        reward.status = "PAID";
        reward.paid_at = now();
      }
    }
    audit(db, { actorId: admin.id, action: "release_wallet_tx", targetTable: "wallet_transactions", targetId: id });
  });
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/referrals");
}

// === 출금 신청 처리 ===================================================
export async function processPayoutAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const id = String(fd.get("id") || "");
  const decision = String(fd.get("decision") || ""); // approve | reject | paid
  let missingLedger = false;
  tx((db) => {
    const pr = db.payout_requests.find((x) => x.id === id);
    if (!pr) return;
    // 출금 신청 시 생성된 원장(payout) 행이 반드시 있어야 처리한다.
    // (원장 없이 처리하면 지급가능 잔액이 차감되지 않아 같은 금액을 다시 출금할 수 있음)
    const ledgerRows = db.wallet_transactions.filter(
      (t) => t.type === "payout" && t.related_table === "payout_requests" && t.related_id === pr.id && t.status !== "cancelled"
    );
    if (ledgerRows.length === 0) {
      missingLedger = true;
      audit(db, { actorId: admin.id, action: `payout_${decision}_blocked_missing_ledger`, targetTable: "payout_requests", targetId: id });
      return;
    }
    let changed = false;
    if (decision === "approve" && pr.status === "requested") {
      pr.status = "approved";
      changed = true;
    } else if (decision === "reject" && (pr.status === "requested" || pr.status === "approved")) {
      pr.status = "rejected";
      pr.processed_at = now();
      // 반려 시 묶었던 금액을 available 로 환원
      const w = db.wallets.find((x) => x.user_id === pr.user_id);
      if (w) {
        w.available_balance += pr.amount;
        w.updated_at = now();
      }
      ledgerRows.forEach((t) => {
        t.status = "cancelled";
        t.updated_at = now();
      });
      changed = true;
    } else if (decision === "paid" && pr.status === "approved") {
      pr.status = "paid";
      pr.processed_at = now();
      pr.resident_id_number = null;
      const w = db.wallets.find((x) => x.user_id === pr.user_id);
      if (w) {
        w.paid_balance += pr.amount;
        w.updated_at = now();
      }
      ledgerRows.forEach((t) => {
        t.status = "paid";
        t.updated_at = now();
      });
      changed = true;
    }
    if (!changed) return;
    notifyUser(db, {
      recipientId: pr.user_id,
      title: decision === "approve" ? "출금 신청이 승인되었습니다" : decision === "paid" ? "출금이 완료되었습니다" : "출금 신청이 반려되었습니다",
      message: `${pr.amount.toLocaleString()}원${decision === "reject" ? " · 신청 금액은 지급가능 잔액으로 환원되었습니다." : ""}`,
      link: "/creator/points",
    });
    audit(db, {
      actorId: admin.id,
      action: `payout_${decision}`,
      targetTable: "payout_requests",
      targetId: id,
    });
  });
  revalidatePath("/admin/payouts");
  if (missingLedger) {
    redirect(`/admin/payouts?${new URLSearchParams({ notice: "이 출금 건은 수익 원장(출금 행)이 없어 처리할 수 없습니다. scripts/migrate-2026-09-ledger-fix.mjs 로 데이터를 보정한 뒤 다시 시도하세요.", tone: "error" })}`);
  }
}

// === 추천인 제도 ON/OFF + 유료 부업 ======================================
export async function updateReferralSystemAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.referral_system_enabled = bool(fd, "referral_system_enabled");
    db.settings.is_paid_model = bool(fd, "is_paid_model");
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_referral_system", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
}

// === 유료 부업 정책 설정 ================================================
export async function updatePolicyAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.is_paid_model = bool(fd, "is_paid_model");
    db.settings.referral_bonus = num(fd, "referral_bonus");
    db.settings.referral_system_enabled = bool(fd, "referral_system_enabled");
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_policy", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/referrals");
}

// === 추천인 수당 지급 처리 (PENDING → PAID) ============================
export async function payReferralRewardAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
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
      actorId: admin.id,
      action: "pay_referral_reward",
      targetTable: "referral_rewards",
      targetId: id,
    });
  });
  revalidatePath("/admin/referrals");
}

// === 추천인 수당 취소 (PENDING → CANCELLED) ============================
export async function cancelReferralRewardAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
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
      actorId: admin.id,
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
  const admin = requireAdmin();
  tx((db) => {
    db.settings.member_video_sale_price_tiers = db.settings.member_video_sale_price_tiers.map((t) => ({
      ...t,
      price: Math.max(0, Math.floor(Number(fd.get(`tier_${t.key}_price`) || t.price))),
      creator_payout: Math.max(0, Math.floor(Number(fd.get(`tier_${t.key}_creator`) ?? t.creator_payout ?? 0))),
    }));
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_settings", targetTable: "settings", targetId: "member_video_sale_price_tiers" });
  });
  revalidatePath("/admin/settings");
}

// === 주민번호 삭제 (항목 4) =============================================
// 페이아웃 건별 주민등록번호를 null로 초기화 (원천징수 처리 완료 후 즉시 폐기)
export async function clearSsnAction(payoutId: string): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    const pr = db.payout_requests.find((x) => x.id === payoutId);
    if (!pr) return;
    pr.resident_id_number = null;
    audit(db, {
      actorId: admin.id,
      action: "clear_ssn",
      targetTable: "payout_requests",
      targetId: payoutId,
    });
  });
  revalidatePath("/admin/payouts");
}

// === SNS 채널 인증 승인/반려 (크리에이터 캠페인 참여 자격) ===============
export async function setSocialVerificationAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const id = String(fd.get("id") || "");
  const decision = String(fd.get("decision") || ""); // verify | reject
  const memo = String(fd.get("memo") || "").trim();
  if (decision !== "verify" && decision !== "reject") return;
  tx((db) => {
    const account = db.social_accounts.find((s) => s.id === id);
    if (!account) return;
    const before = account.verified_status;
    account.verified_status = decision === "verify" ? "verified" : "unverified";
    account.updated_at = now();
    notifyUser(db, {
      recipientId: account.creator_id,
      title: decision === "verify" ? "SNS 채널이 인증되었습니다" : "SNS 채널 인증이 반려되었습니다",
      message: `${account.account_name}${decision === "verify" ? " · 이제 해당 플랫폼 캠페인에 참여할 수 있습니다." : memo ? ` · 사유: ${memo}` : " · 채널 정보를 확인 후 다시 요청해 주세요."}`,
      link: "/creator/social",
    });
    audit(db, { actorId: admin.id, action: `social_${decision}`, targetTable: "social_accounts", targetId: id, before: { verified_status: before }, after: { verified_status: account.verified_status, memo } });
  });
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members`);
}
