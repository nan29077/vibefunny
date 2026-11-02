import { genId } from "./crypto";
import { isVibeMember } from "./membership";
import type {
  AuditLog,
  Database,
  ReferralReward,
  Payment,
  PaymentType,
  PointTransaction,
  PointTxType,
  PointWallet,
  Wallet,
  WalletTransaction,
  WalletTxStatus,
  WalletTxType,
  Notification,
  NotificationCategory,
} from "./schema";

// ===========================================================================
// 공용 서비스/원장(ledger) 헬퍼. 모두 db 스냅샷을 받아 직접 수정한다.
// 반드시 db.tx() 내부에서 호출하여 원자적으로 저장되게 한다.
// ===========================================================================

const now = () => new Date().toISOString();

export function notifyUser(
  db: Database,
  params: { recipientId: string; title: string; message: string; link?: string; category?: NotificationCategory }
): Notification | null {
  // 수신자가 해당 분류 알림을 끈 경우 생성하지 않음 (분류 없는 중요 알림은 항상 생성)
  if (params.category) {
    const recipient = db.profiles.find((p) => p.id === params.recipientId);
    if (recipient?.notification_prefs?.[params.category] === false) return null;
  }
  if (!db.notifications) db.notifications = [];
  const recentCutoff = Date.now() - 60_000;
  // 같은 사건의 중복 호출만 합친다 (제목·내용·링크가 모두 같고 1분 이내)
  const existing = db.notifications.find((item) => item.recipient_id === params.recipientId && item.title === params.title && item.message === params.message && (item.link ?? null) === (params.link ?? null) && new Date(item.created_at).getTime() >= recentCutoff);
  if (existing) return existing;
  const notification: Notification = {
    id: genId(), recipient_id: params.recipientId, title: params.title, message: params.message,
    link: params.link ?? null, read_at: null, created_at: now(),
  };
  db.notifications.push(notification);
  const recipientItems = db.notifications.filter((item) => item.recipient_id === params.recipientId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const removeIds = new Set(recipientItems.slice(500).map((item) => item.id));
  if (removeIds.size) db.notifications = db.notifications.filter((item) => !removeIds.has(item.id));
  return notification;
}

// --- 수익 지갑 -----------------------------------------------------------
export function ensureWallet(db: Database, userId: string): Wallet {
  let w = db.wallets.find((x) => x.user_id === userId);
  if (!w) {
    w = {
      id: genId(),
      user_id: userId,
      pending_balance: 0,
      available_balance: 0,
      paid_balance: 0,
      created_at: now(),
      updated_at: now(),
    };
    db.wallets.push(w);
  }
  return w;
}

/**
 * 수익 원장 기록 + 지갑 잔액 갱신.
 * status=pending  -> pending_balance += amount
 * status=available-> available_balance += amount
 * type=payout(음수, status=requested/paid) 는 출금 흐름에서 별도 처리.
 */
export function addWalletTx(
  db: Database,
  params: {
    userId: string;
    type: WalletTxType;
    amount: number;
    status: WalletTxStatus;
    relatedTable?: string;
    relatedId?: string;
    memo?: string;
  }
): WalletTransaction {
  const w = ensureWallet(db, params.userId);
  const txn: WalletTransaction = {
    id: genId(),
    user_id: params.userId,
    type: params.type,
    amount: params.amount,
    status: params.status,
    related_table: params.relatedTable ?? null,
    related_id: params.relatedId ?? null,
    memo: params.memo ?? null,
    created_at: now(),
    updated_at: now(),
  };
  db.wallet_transactions.push(txn);

  if (params.status === "pending") {
    w.pending_balance += params.amount;
  } else if (params.status === "available") {
    w.available_balance += params.amount;
  }
  w.updated_at = now();
  return txn;
}

/** 같은 업무 건에 대한 수익을 한 번만 지급한다. */
export function addWalletTxOnce(
  db: Database,
  params: Parameters<typeof addWalletTx>[1]
): WalletTransaction {
  const existing = db.wallet_transactions.find(
    (item) =>
      item.user_id === params.userId &&
      item.type === params.type &&
      item.related_table === (params.relatedTable ?? null) &&
      item.related_id === (params.relatedId ?? null) &&
      item.status !== "cancelled"
  );
  return existing ?? addWalletTx(db, params);
}

/** pending -> available 전환 (작업 최종 승인 시) */
export function makeWalletTxAvailable(db: Database, txId: string): void {
  const txn = db.wallet_transactions.find((t) => t.id === txId);
  if (!txn || txn.status !== "pending") return;
  const w = ensureWallet(db, txn.user_id);
  w.pending_balance -= txn.amount;
  w.available_balance += txn.amount;
  w.updated_at = now();
  txn.status = "available";
  txn.updated_at = now();
}

// --- 포인트 지갑 ---------------------------------------------------------
export function ensurePointWallet(db: Database, advertiserId: string): PointWallet {
  let pw = db.point_wallets.find((x) => x.advertiser_id === advertiserId);
  if (!pw) {
    pw = {
      id: genId(),
      advertiser_id: advertiserId,
      point_balance: 0,
      created_at: now(),
      updated_at: now(),
    };
    db.point_wallets.push(pw);
  }
  return pw;
}

/**
 * 포인트 원장 기록 + 잔액 갱신. amount는 +충전/환불, -사용.
 * 포인트 직접 수정 금지 → 반드시 이 함수를 통해 거래내역과 함께 변경.
 */
export function addPointTx(
  db: Database,
  params: {
    advertiserId: string;
    type: PointTxType;
    amount: number;
    paymentId?: string;
    campaignId?: string;
    memo?: string;
    /** 수수료 회수(clawback) 전용: 잔액이 마이너스가 되어도 허용 — 다음 충전·적립에서 자연히 상계된다 */
    allowNegative?: boolean;
  }
): PointTransaction {
  const pw = ensurePointWallet(db, params.advertiserId);
  // 잔액이 음수가 되는 차감은 허용하지 않는다 (예외 → tx 전체가 저장되지 않음). 수수료 회수만 예외
  if (!params.allowNegative && params.amount < 0 && pw.point_balance + params.amount < 0) {
    throw new Error(`포인트 잔액 부족: 잔액 ${pw.point_balance}, 차감 ${-params.amount}`);
  }
  pw.point_balance += params.amount;
  pw.updated_at = now();
  const txn: PointTransaction = {
    id: genId(),
    advertiser_id: params.advertiserId,
    type: params.type,
    amount: params.amount,
    balance_after: pw.point_balance,
    payment_id: params.paymentId ?? null,
    campaign_id: params.campaignId ?? null,
    memo: params.memo ?? null,
    created_at: now(),
  };
  db.point_transactions.push(txn);
  return txn;
}

export function addPointTxOnce(
  db: Database,
  params: Parameters<typeof addPointTx>[1]
): PointTransaction {
  const existing = db.point_transactions.find(
    (item) => item.advertiser_id === params.advertiserId && item.type === params.type && item.campaign_id === (params.campaignId ?? null)
  );
  return existing ?? addPointTx(db, params);
}

// --- 결제 레코드 생성 ----------------------------------------------------
export function createPayment(
  db: Database,
  params: {
    userId: string;
    paymentType: PaymentType;
    amount: number;
    metadata?: Record<string, unknown>;
  }
): Payment {
  const payment: Payment = {
    id: genId(),
    user_id: params.userId,
    payment_type: params.paymentType,
    amount: params.amount,
    status: "pending",
    provider: process.env.PAYMENT_PROVIDER || "mock",
    provider_payment_id: null,
    metadata_json: params.metadata ?? {},
    created_at: now(),
    paid_at: null,
  };
  db.payments.push(payment);
  return payment;
}

// --- 감사 로그 -----------------------------------------------------------
export function audit(
  db: Database,
  params: {
    actorId: string | null;
    action: string;
    targetTable?: string;
    targetId?: string;
    before?: unknown;
    after?: unknown;
  }
): void {
  const log: AuditLog = {
    id: genId(),
    actor_id: params.actorId,
    action: params.action,
    target_table: params.targetTable ?? null,
    target_id: params.targetId ?? null,
    before_json: params.before ?? null,
    after_json: params.after ?? null,
    created_at: now(),
  };
  db.audit_logs.push(log);
}

// --- 추천 수당: 가입비 결제 완료 후 생성 ---------------------------------
export function createSignupReferralReward(
  db: Database,
  refereeId: string,
  signupFeeAmount: number
): void {
  const referee = db.profiles.find((p) => p.id === refereeId);
  if (!referee || !referee.referred_by_user_id) return;
  if (signupFeeAmount <= 0) return;
  const referrer = db.profiles.find((p) => p.id === referee.referred_by_user_id);
  if (!referrer) return;
  if (referrer.id === referee.id || referrer.status !== "active") return; // 자기추천·비활성 추천인 제외
  if (referrer.role === "admin") return; // 회사 추천 코드(최고관리자)로 가입한 경우 수당 없음
  // 멘토가 그 사이 일반회원으로 바뀌었다면 수당 없음 (바이브회원만 멘토)
  if (referrer.role === "creator" && !isVibeMember(db, referrer)) return;
  if (!db.settings.referral_system_enabled) return; // 결제 시점에 추천인 제도가 꺼져 있으면 미지급
  if (db.referral_rewards.some((item) => item.referee_id === referee.id && item.referrer_id === referrer.id)) return;
  // 관리자 정책 설정 화면의 "역할별 추천 수당" 금액을 사용한다.
  // (이전: 유료 부업 ON 이면 화면에 없는 숨은 값 referral_bonus 가 적용되어 설정 금액과 다르게 지급됨)
  const roleAmount = db.settings.fees[referee.role]?.referral_reward_amount ?? 0;
  // 관리자가 0원으로 저장했다면 "지급 안 함"으로 본다 (숨은 기본값 referral_bonus 로 대체 지급하지 않음)
  const reward = Math.max(0, roleAmount);
  if (reward <= 0) return;
  createReferralRewardRecord(db, referrer.id, referee.id, reward);
}


// --- 추천 수당 레코드 생성 (ReferralReward) + WalletTx -----------------
/**
 * 추천인 제도가 켜져 있고 멘티가 가입비를 결제하면 호출 — 역할별 고정 수당을 1회 적립한다.
 */
export function createReferralRewardRecord(
  db: Database,
  referrerId: string,
  refereeId: string,
  amount: number
): ReferralReward | null {
  if (amount <= 0) return null;
  const wtx = addWalletTx(db, {
    userId: referrerId,
    type: "signup_referral",
    amount,
    status: "pending",
    relatedTable: "profiles",
    relatedId: refereeId,
    memo: `신규 회원 추천 수당 ${amount.toLocaleString()}원`,
  });
  const reward: ReferralReward = {
    id: genId(),
    referrer_id: referrerId,
    referee_id: refereeId,
    amount,
    status: "PENDING",
    wallet_tx_id: wtx.id,
    created_at: now(),
    paid_at: null,
  };
  db.referral_rewards.push(reward);
  return reward;
}

// 실행사 수수료는 campaign-workflow.ts 의 applyAgencyCommission(포인트 지갑, type=commission) 한 곳에서만 처리한다.
