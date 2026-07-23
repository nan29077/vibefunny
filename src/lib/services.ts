import { genId } from "./crypto";
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
} from "./schema";

// ===========================================================================
// 공용 서비스/원장(ledger) 헬퍼. 모두 db 스냅샷을 받아 직접 수정한다.
// 반드시 db.tx() 내부에서 호출하여 원자적으로 저장되게 한다.
// ===========================================================================

const now = () => new Date().toISOString();

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
  }
): PointTransaction {
  const pw = ensurePointWallet(db, params.advertiserId);
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

// --- 실행사 수직 수수료 생성 (대행사 광고 집행 시) ----------------------
export function createAdvertiserCommission(
  db: Database,
  params: { agencyId: string; baseAmount: number; campaignId?: string; memo?: string }
): void {
  const agency = db.profiles.find((p) => p.id === params.agencyId);
  if (!agency || !agency.parent_advertiser_id) return; // 상위 실행사 없음
  const rate = db.settings.advertiser_commission_rate;
  if (rate <= 0 || params.baseAmount <= 0) return;
  const commission = Math.floor((params.baseAmount * rate) / 100);
  if (commission <= 0) return;
  // 실행사 수수료는 조건 충족 후 생성 -> pending (관리자 확인 후 지급가능)
  addWalletTx(db, {
    userId: agency.parent_advertiser_id,
    type: "advertiser_commission",
    amount: commission,
    status: "pending",
    relatedTable: "ad_campaigns",
    relatedId: params.campaignId,
    memo: params.memo ?? `${agency.name} 광고 집행 ${rate}% 수수료`,
  });
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
  if (db.referral_rewards.some((item) => item.referee_id === referee.id && item.referrer_id === referrer.id)) return;
  const reward = db.settings.fees[referee.role]?.referral_reward_amount ?? 0;
  if (reward <= 0) return;
  createReferralRewardRecord(db, referrer.id, referee.id, reward);
}


// --- 추천 수당 레코드 생성 (ReferralReward) + WalletTx -----------------
/**
 * 추천인 제도가 활성화된 상태에서 피추천인이 가입하면 호출.
 * - is_paid_model=true: 고정 referral_bonus 금액
 * - is_paid_model=false + signup_fee 있음: 가입비 기준 비율 계산 (기존 로직)
 * 두 경우 모두 ReferralReward 레코드를 생성한다.
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

// --- 대행사 → 실행사 수수료 적립 (대행사 결제 시 호출) ------------------
/**
 * 대행사가 포인트 충전 또는 광고 주문 결제 시 실행사에게 수수료를 적립한다.
 * - 수수료율: db.settings.advertiser_commission_rate
 * - 적립 기준: db.settings.advertiser_commission_basis (호출 시점에 이미 필터링)
 */
export function createAgencyCommission(
  db: Database,
  agencyId: string,
  amount: number,
  memo?: string
): void {
  createAdvertiserCommission(db, {
    agencyId,
    baseAmount: amount,
    memo: memo ?? `대행사 결제액 ${amount.toLocaleString()}원 기준 실행사 수수료`,
  });
}

// --- 대행사 포인트 충전 시 실행사 포인트 수수료 적립 --------------------
/**
 * 대행사가 포인트를 충전할 때 실행사(referral_relations 기준)의 포인트 지갑에
 * admin 설정 commission rate% 를 적립한다.
 */
export function createAgencyPointCommission(
  db: Database,
  agencyId: string,
  chargeAmount: number,
  paymentId?: string
): void {
  // referral_relations에서 이 대행사를 추천한 실행사 찾기
  const relation = db.referral_relations.find(
    (r) => r.referee_id === agencyId && r.referral_type === "advertiser_hierarchy"
  );
  if (!relation) return; // 연결된 실행사 없음

  const executionCompanyId = relation.referrer_id;
  const rate = db.settings.advertiser_commission_rate;
  if (rate <= 0 || chargeAmount <= 0) return;

  const commission = Math.floor((chargeAmount * rate) / 100);
  if (commission <= 0) return;

  const agency = db.profiles.find((p) => p.id === agencyId);
  addPointTx(db, {
    advertiserId: executionCompanyId,
    type: "charge",
    amount: commission,
    paymentId, // 대행사 결제 ID → 어느 대행사에서 발생했는지 역추적 가능
    memo: `${agency?.name ?? agencyId} 포인트 충전 ${rate}% 수수료 적립 (충전액 ${chargeAmount.toLocaleString()}원)`,
  });
}
