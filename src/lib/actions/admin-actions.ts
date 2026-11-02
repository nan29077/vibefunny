"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireAdmin } from "../auth";
import { genId } from "../crypto";
import { audit, createReferralRewardRecord, makeWalletTxAvailable, notifyUser } from "../services";
import { displayName } from "../schema";
import { isVibeMember } from "../membership";
import type { CommissionBasis, Platform, Role, UserStatus } from "../schema";

const now = () => new Date().toISOString();
const num = (fd: FormData, k: string) => {
  const v = Math.floor(Number(fd.get(k) || 0));
  return Number.isFinite(v) ? Math.max(0, v) : 0; // NaN/Infinity 입력 방지
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";

/**
 * 정책 금액 입력 검증. 빈 칸은 0, 음수·소수·범위 초과·숫자가 아니면 오류 목록에 추가한다.
 * (예전에는 음수를 조용히 0으로 바꿔 저장 → 청구단가 0원이 되어 배포마다 플랫폼이 손해를 보는 실수가 가능했다)
 */
function readAmount(fd: FormData, key: string, label: string, errors: string[], max = 100_000_000, min = 0): number {
  const raw = String(fd.get(key) ?? "").trim();
  if (raw === "") return 0;
  const v = Number(raw);
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v < min || v > max) {
    errors.push(`${label}: ${min.toLocaleString()} ~ ${max.toLocaleString()} 사이의 정수로 입력하세요.`);
    return 0;
  }
  return v;
}
function settingsNotice(errors: string[], warnings: string[] = []): never | void {
  if (errors.length) redirect(`/admin/settings?${new URLSearchParams({ notice: `저장하지 않았습니다 — ${errors.join(" / ")}`, tone: "error" })}`);
  if (warnings.length) redirect(`/admin/settings?${new URLSearchParams({ notice: `저장했습니다. 확인 필요: ${warnings.join(" / ")}`, tone: "warn" })}`);
}
/** 저장 성공 — 이전 오류 안내(?tone=error)가 주소에 남아 계속 보이지 않도록 성공 안내로 바꿔 이동 */
function settingsSaved(): never {
  redirect(`/admin/settings?${new URLSearchParams({ notice: "저장했습니다.", tone: "ok" })}`);
}

// === 4.1/4.2 가입비·추천수당 설정 (광고주 가입비 제외) ==================
export async function updateFeesAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const roles: Role[] = ["creator", "advertiser"];
  const errors: string[] = [];
  for (const role of roles) {
    if (!fd.has(`${role}_referral_amount`)) continue;
    if (role === "creator") readAmount(fd, `${role}_signup_amount`, "가입비 금액", errors);
    readAmount(fd, `${role}_referral_amount`, "추천 수당", errors);
  }
  if (bool(fd, "creator_signup_enabled") && fd.has("creator_signup_amount") && !(Number(fd.get("creator_signup_amount")) > 0)) {
    errors.push("가입비 사용 시 가입비 금액은 1원 이상이어야 합니다.");
  }
  settingsNotice(errors);
  tx((db) => {
    for (const role of roles) {
      // 화면에 그 역할의 입력칸이 없으면 기존 값을 그대로 둔다 (빈 값이 0원으로 저장되던 문제 방지)
      if (!fd.has(`${role}_referral_amount`)) continue;
      const f = db.settings.fees[role];
      // 광고주는 가입비 항목 미사용
      if (role === "creator") {
        f.signup_fee_enabled = bool(fd, `${role}_signup_enabled`);
        f.signup_fee_amount = num(fd, `${role}_signup_amount`);
      }
      f.referral_reward_amount = num(fd, `${role}_referral_amount`);
    }
    // 가입비를 끄거나 금액을 바꾸면, 옛 조건으로 만들어진 대기 중 가입비 결제는 취소한다 (다시 결제하면 새 금액으로 생성)
    const creatorFee = db.settings.fees.creator;
    const current = creatorFee?.signup_fee_enabled ? creatorFee.signup_fee_amount ?? 0 : 0;
    for (const pay of db.payments) {
      if (pay.payment_type !== "signup_fee" || pay.status !== "pending") continue;
      const owner = db.profiles.find((x) => x.id === pay.user_id);
      if (owner?.role !== "creator" || (current > 0 && pay.amount === current)) continue;
      pay.status = "cancelled";
      pay.metadata_json = { ...pay.metadata_json, cancel_reason: current > 0 ? "fee_amount_changed" : "fee_disabled" };
    }
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_fees", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  settingsSaved();
}

// === 4.3 영상 제작 단가 ================================================
export async function updateVideoPricingAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const errors: string[] = [];
  const warnings: string[] = [];
  tx((db) => {
    const next = db.settings.video_pricing_tiers.map((t) => {
      const amount = fd.has(`tier_${t.key}`) ? readAmount(fd, `tier_${t.key}`, `${t.label} 크리에이터 제작 단가`, errors) : t.amount;
      const charge = fd.has(`tier_${t.key}_charge`) ? readAmount(fd, `tier_${t.key}_charge`, `${t.label} 광고주 청구 단가`, errors) : t.advertiser_charge ?? 0;
      if (t.max_seconds !== null && charge < amount) warnings.push(`${t.label}: 광고주 청구 단가가 크리에이터 제작 단가보다 낮습니다`);
      return { ...t, amount, advertiser_charge: charge };
    });
    if (errors.length) return;
    db.settings.video_pricing_tiers = next;
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_video_pricing", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  settingsNotice(errors, warnings);
  settingsSaved();
}

// === 4.5 배포 단가 ====================================================
export async function updateDistributionAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const errors: string[] = [];
  const warnings: string[] = [];
  tx((db) => {
    const rates = db.settings.distribution_rates.map((r) => {
      const creator_payout = fd.has(`${r.platform}_payout`) ? readAmount(fd, `${r.platform}_payout`, `${r.label} 크리에이터 지급액`, errors) : r.creator_payout;
      const advertiser_charge = fd.has(`${r.platform}_charge`) ? readAmount(fd, `${r.platform}_charge`, `${r.label} 광고주 청구액`, errors) : r.advertiser_charge;
      if (advertiser_charge < creator_payout) warnings.push(`${r.label}: 광고주 청구액이 크리에이터 지급액보다 낮습니다`);
      return { ...r, creator_payout, advertiser_charge };
    });
    const extraPayout = fd.has("extra_creation_creator_payout") ? readAmount(fd, "extra_creation_creator_payout", "추가 제작비 크리에이터 지급액", errors) : db.settings.extra_creation_creator_payout;
    const extraCharge = fd.has("extra_creation_advertiser_charge") ? readAmount(fd, "extra_creation_advertiser_charge", "추가 제작비 광고주 청구액", errors) : db.settings.extra_creation_advertiser_charge;
    if (errors.length) return;
    db.settings.distribution_rates = rates;
    db.settings.extra_creation_creator_payout = extraPayout;
    db.settings.extra_creation_advertiser_charge = extraCharge;
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_distribution", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  settingsNotice(errors, warnings);
  settingsSaved();
}

// === 4.6 광고주 수직 수수료 ===========================================
export async function updateAdvertiserCommissionAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const errors: string[] = [];
  const rate = readAmount(fd, "commission_rate", "실행사 수수료율(%)", errors, 100); // 수수료율 0~100% 정수
  settingsNotice(errors);
  tx((db) => {
    db.settings.advertiser_commission_rate = rate;
    // 허용된 기준값만 저장 (그 밖의 값은 기존 설정 유지)
    const basis = String(fd.get("commission_basis") || "");
    if (["agency_charge", "agency_spend", "campaign_completed"].includes(basis)) {
      db.settings.advertiser_commission_basis = basis as CommissionBasis;
    }
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_advertiser_commission", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  settingsSaved();
}

// === 출금 정책 (최소 출금액) ==========================================
export async function updatePayoutPolicyAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const errors: string[] = [];
  const min = readAmount(fd, "min_payout_amount", "최소 출금액", errors, 10_000_000, 1);
  if (!errors.length && min < 1) errors.push("최소 출금액은 1원 이상 입력하세요.");
  settingsNotice(errors);
  tx((db) => {
    db.settings.min_payout_amount = min;
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_payout_policy", targetTable: "settings", after: { min_payout_amount: min } });
  });
  revalidatePath("/admin/settings");
  settingsSaved();
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
  // 관리자가 바꿀 수 있는 상태만 허용 (pending 은 가입비 결제 흐름 전용)
  if (!["active", "suspended", "withdrawn"].includes(status)) return;
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

// === 크리에이터 회원 등급 변경 (관리자) ===================================
// grant=1: 가입비 면제로 바이브회원 전환 (추천 수당 없음, 대기 중인 가입비 결제는 취소)
// grant=0: 일반회원으로 되돌리기
export async function setVibeMemberAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const id = String(fd.get("id") || "");
  const grant = fd.get("grant") === "1";
  tx((db) => {
    const u = db.profiles.find((x) => x.id === id);
    if (!u || u.role !== "creator") return;
    const before = u.vibe_member_at ?? null;
    if (grant) {
      if (u.vibe_member_at) return;
      u.vibe_member_at = now();
      if (u.status === "pending") u.status = "active";
      for (const p of db.payments) {
        if (p.user_id === u.id && p.payment_type === "signup_fee" && p.status === "pending") {
          p.status = "cancelled";
          p.metadata_json = { ...p.metadata_json, cancel_reason: "admin_fee_waived" };
        }
      }
    } else {
      if (!u.vibe_member_at) return;
      u.vibe_member_at = null;
    }
    u.updated_at = now();
    audit(db, {
      actorId: admin.id,
      action: grant ? "grant_vibe_member" : "revoke_vibe_member",
      targetTable: "profiles",
      targetId: id,
      before: { vibe_member_at: before },
      after: { vibe_member_at: u.vibe_member_at ?? null },
    });
  });
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
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
      link: "/creator/wallet",
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

// === 추천인 제도 ON/OFF ======================================
export async function updateReferralSystemAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.referral_system_enabled = bool(fd, "referral_system_enabled");
    db.settings.updated_at = now();
    audit(db, { actorId: admin.id, action: "update_referral_system", targetTable: "settings" });
  });
  revalidatePath("/admin/settings");
  settingsSaved();
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
    const referee = db.profiles.find((p) => p.id === reward.referee_id);
    notifyUser(db, {
      recipientId: reward.referrer_id,
      title: "추천 수당이 지급되었습니다",
      message: `${referee ? displayName(referee) : "멘티"}님 가입비 결제 수당 ${reward.amount.toLocaleString()}원 · 수익/출금에서 출금할 수 있습니다.`,
      link: "/creator/wallet",
    });
    audit(db, {
      actorId: admin.id,
      action: "pay_referral_reward",
      targetTable: "referral_rewards",
      targetId: id,
    });
  });
  revalidatePath("/admin/referrals");
  redirect(`/admin/referrals?${new URLSearchParams({ notice: "추천 수당을 지급 처리했습니다." })}`);
}

// === 추천 수당 수동 생성 (추천인 제도가 꺼져 있을 때 결제한 멘티 등 소급 지급) =============
export async function createMissingReferralRewardAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const refereeId = String(fd.get("referee_id") || "");
  let notice = "";
  let created = false;
  tx((db) => {
    const referee = db.profiles.find((p) => p.id === refereeId);
    if (!referee || referee.role !== "creator" || !referee.referred_by_user_id) { notice = "대상 멘티를 찾을 수 없습니다."; return; }
    const paid = db.payments.some((p) => p.user_id === referee.id && p.payment_type === "signup_fee" && p.status === "paid");
    if (!paid) { notice = "가입비 결제 기록이 있는 멘티만 수당을 생성할 수 있습니다."; return; }
    const mentor = db.profiles.find((p) => p.id === referee.referred_by_user_id);
    if (!mentor || mentor.role !== "creator") { notice = "회사 추천 코드로 가입한 멘티는 수당 대상이 아닙니다."; return; }
    if (mentor.status !== "active") { notice = "멘토 계정이 활성 상태가 아닙니다."; return; }
    if (!isVibeMember(db, mentor)) { notice = "멘토가 바이브회원이 아니어서 수당 대상이 아닙니다."; return; }
    if (db.referral_rewards.some((r) => r.referee_id === referee.id && r.referrer_id === mentor.id)) { notice = "이미 수당 기록이 있습니다."; return; }
    const amount = Math.max(0, db.settings.fees.creator?.referral_reward_amount ?? 0);
    if (amount <= 0) { notice = "정책 설정의 크리에이터 추천 수당 금액이 0원입니다."; return; }
    const reward = createReferralRewardRecord(db, mentor.id, referee.id, amount);
    notifyUser(db, {
      recipientId: mentor.id,
      title: "추천 수당이 적립되었습니다",
      message: `${displayName(referee)}님 가입비 결제 수당 ${amount.toLocaleString()}원 (지급 대기)`,
      link: "/creator/referrals",
    });
    audit(db, { actorId: admin.id, action: "create_missing_referral_reward", targetTable: "referral_rewards", targetId: reward?.id, after: { referee_id: referee.id, amount } });
    notice = `${displayName(mentor)}님에게 추천 수당 ${amount.toLocaleString()}원(지급 대기)을 생성했습니다.`;
    created = true;
  });
  revalidatePath("/admin/referrals");
  redirect(`/admin/referrals?${new URLSearchParams(created ? { notice } : { notice, tone: "error" })}`);
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
    notifyUser(db, {
      recipientId: reward.referrer_id,
      title: "추천 수당이 취소되었습니다",
      message: `${reward.amount.toLocaleString()}원 · 문의는 고객센터로 연락해 주세요.`,
      link: "/creator/referrals",
    });
    audit(db, {
      actorId: admin.id,
      action: "cancel_referral_reward",
      targetTable: "referral_rewards",
      targetId: id,
    });
  });
  revalidatePath("/admin/referrals");
  redirect(`/admin/referrals?${new URLSearchParams({ notice: "추천 수당을 취소했습니다." })}`);
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
