import { genId } from "./crypto";
import type { Database, FunnyTransaction, FunnyTxType, FunnyWallet } from "./schema";

// ===========================================================================
// 퍼니 지갑·원장 (AI 숏츠 제작 크레딧). 반드시 db.tx() 안에서 호출한다.
// - 1퍼니 = 10원. 충전(paid)과 보너스(bonus)를 나눠 관리하고 보너스부터 쓴다.
// - 잔액은 항상 원장(funny_transactions)과 함께 바뀐다. 직접 수정 금지.
// - 수익 지갑(wallets, 출금 대상)과는 완전히 별개이며 출금·회원 간 이전 기능이 없다.
// ===========================================================================

export const FUNNY_WON = 10;

const now = () => new Date().toISOString();

export class FunnyError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function formatFunny(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}퍼니`;
}

export function funnyTables(db: Database) {
  if (!db.funny_wallets) db.funny_wallets = [];
  if (!db.funny_transactions) db.funny_transactions = [];
  return { wallets: db.funny_wallets, txs: db.funny_transactions };
}

export function findFunnyWallet(db: Database, userId: string): FunnyWallet | null {
  return (db.funny_wallets ?? []).find((w) => w.user_id === userId) ?? null;
}

export function ensureFunnyWallet(db: Database, userId: string): FunnyWallet {
  const { wallets } = funnyTables(db);
  let w = wallets.find((x) => x.user_id === userId);
  if (!w) {
    w = { id: genId(), user_id: userId, paid_balance: 0, bonus_balance: 0, held_paid: 0, held_bonus: 0, created_at: now(), updated_at: now() };
    wallets.push(w);
  }
  return w;
}

/** 화면 표시용 요약 */
export function funnyBalance(db: Database, userId: string) {
  const w = findFunnyWallet(db, userId);
  const paid = w?.paid_balance ?? 0;
  const bonus = w?.bonus_balance ?? 0;
  const held = (w?.held_paid ?? 0) + (w?.held_bonus ?? 0);
  return { paid, bonus, held, available: paid + bonus };
}

function record(
  db: Database,
  w: FunnyWallet,
  entry: { type: FunnyTxType; paid?: number; bonus?: number; held?: number; charged?: number; paymentId?: string | null; jobId?: string | null; memo?: string | null; actorId?: string | null }
): FunnyTransaction {
  const { txs } = funnyTables(db);
  // 불변식: 어떤 잔액도 음수가 될 수 없다 (위반 시 트랜잭션 전체가 롤백되도록 예외)
  if (w.paid_balance < 0 || w.bonus_balance < 0 || w.held_paid < 0 || w.held_bonus < 0) {
    throw new FunnyError("퍼니 잔액 계산 오류가 발생했습니다. 관리자에게 문의하세요.", 500, "funny_invariant");
  }
  w.updated_at = now();
  const t: FunnyTransaction = {
    id: genId(),
    user_id: w.user_id,
    type: entry.type,
    paid_delta: entry.paid ?? 0,
    bonus_delta: entry.bonus ?? 0,
    held_delta: entry.held ?? 0,
    paid_after: w.paid_balance,
    bonus_after: w.bonus_balance,
    held_after: w.held_paid + w.held_bonus,
    charged: entry.charged ?? 0,
    payment_id: entry.paymentId ?? null,
    job_id: entry.jobId ?? null,
    memo: entry.memo ?? null,
    actor_id: entry.actorId ?? null,
    created_at: now(),
  };
  txs.push(t);
  return t;
}

function assertAmount(n: number, label: string) {
  if (!Number.isSafeInteger(n) || n <= 0) throw new FunnyError(`${label}을(를) 확인해 주세요.`);
}

/** 충전(결제 완료) — 결제 1건당 1회만 (멱등) */
export function creditFunnyCharge(db: Database, params: { userId: string; paid: number; bonus: number; paymentId: string; memo?: string }) {
  const { txs } = funnyTables(db);
  if (txs.some((t) => t.payment_id === params.paymentId && t.type === "charge")) return null;
  assertAmount(params.paid, "충전 퍼니");
  const w = ensureFunnyWallet(db, params.userId);
  w.paid_balance += params.paid;
  const main = record(db, w, { type: "charge", paid: params.paid, paymentId: params.paymentId, memo: params.memo ?? "퍼니 충전" });
  if (params.bonus > 0) {
    w.bonus_balance += params.bonus;
    record(db, w, { type: "charge_bonus", bonus: params.bonus, paymentId: params.paymentId, memo: "충전 보너스" });
  }
  return main;
}

/** 관리자 지급(보너스 퍼니) */
export function grantFunny(db: Database, params: { userId: string; amount: number; memo: string; actorId: string }) {
  assertAmount(params.amount, "지급 퍼니");
  const w = ensureFunnyWallet(db, params.userId);
  w.bonus_balance += params.amount;
  return record(db, w, { type: "grant", bonus: params.amount, memo: params.memo, actorId: params.actorId });
}

/** 관리자 회수 — 사용 가능 잔액에서 보너스부터 */
export function revokeFunny(db: Database, params: { userId: string; amount: number; memo: string; actorId: string }) {
  assertAmount(params.amount, "회수 퍼니");
  const w = ensureFunnyWallet(db, params.userId);
  const total = w.paid_balance + w.bonus_balance;
  if (total < params.amount) throw new FunnyError(`회수할 수 있는 퍼니가 부족합니다. (사용 가능 ${formatFunny(total)})`);
  const bonus = Math.min(w.bonus_balance, params.amount);
  const paid = params.amount - bonus;
  w.bonus_balance -= bonus;
  w.paid_balance -= paid;
  return record(db, w, { type: "revoke", paid: -paid, bonus: -bonus, memo: params.memo, actorId: params.actorId });
}

/** AI 작업 시작: 예상 퍼니를 예약한다. 보너스부터. */
export function holdFunny(db: Database, params: { userId: string; amount: number; jobId: string; memo?: string }) {
  assertAmount(params.amount, "예약 퍼니");
  const w = ensureFunnyWallet(db, params.userId);
  const total = w.paid_balance + w.bonus_balance;
  if (total < params.amount) {
    throw new FunnyError(
      `퍼니가 부족합니다. ${formatFunny(params.amount)}가 필요하고 사용 가능한 퍼니는 ${formatFunny(total)}입니다.`,
      402,
      "insufficient_funny"
    );
  }
  const holdBonus = Math.min(w.bonus_balance, params.amount);
  const holdPaid = params.amount - holdBonus;
  w.bonus_balance -= holdBonus;
  w.paid_balance -= holdPaid;
  w.held_bonus += holdBonus;
  w.held_paid += holdPaid;
  record(db, w, { type: "hold", paid: -holdPaid, bonus: -holdBonus, held: params.amount, jobId: params.jobId, memo: params.memo });
  return { holdPaid, holdBonus };
}

/** 작업 성공: 실제 사용량만 차감하고 나머지 예약분은 돌려준다. 보너스 예약분부터 쓴다. */
export function captureFunny(db: Database, params: { userId: string; jobId: string; holdPaid: number; holdBonus: number; charge: number; memo?: string }) {
  const hold = params.holdPaid + params.holdBonus;
  const used = Math.max(0, Math.min(hold, Math.ceil(params.charge)));
  const usedBonus = Math.min(params.holdBonus, used);
  const usedPaid = used - usedBonus;
  const w = ensureFunnyWallet(db, params.userId);
  if (w.held_paid < params.holdPaid || w.held_bonus < params.holdBonus) {
    throw new FunnyError("퍼니 예약 내역이 맞지 않습니다. 관리자에게 문의하세요.", 500, "funny_hold_mismatch");
  }
  w.held_paid -= params.holdPaid;
  w.held_bonus -= params.holdBonus;
  w.paid_balance += params.holdPaid - usedPaid;
  w.bonus_balance += params.holdBonus - usedBonus;
  record(db, w, {
    type: "spend",
    paid: params.holdPaid - usedPaid,
    bonus: params.holdBonus - usedBonus,
    held: -hold,
    charged: used,
    jobId: params.jobId,
    memo: params.memo,
  });
  return { used, usedPaid, usedBonus };
}

/** 작업 실패·취소: 예약분 전부 돌려준다. */
export function releaseFunny(db: Database, params: { userId: string; jobId: string; holdPaid: number; holdBonus: number; memo?: string }) {
  const hold = params.holdPaid + params.holdBonus;
  if (hold <= 0) return null;
  const w = ensureFunnyWallet(db, params.userId);
  if (w.held_paid < params.holdPaid || w.held_bonus < params.holdBonus) {
    throw new FunnyError("퍼니 예약 내역이 맞지 않습니다. 관리자에게 문의하세요.", 500, "funny_hold_mismatch");
  }
  w.held_paid -= params.holdPaid;
  w.held_bonus -= params.holdBonus;
  w.paid_balance += params.holdPaid;
  w.bonus_balance += params.holdBonus;
  return record(db, w, { type: "release", paid: params.holdPaid, bonus: params.holdBonus, held: -hold, jobId: params.jobId, memo: params.memo });
}

export const FUNNY_TX_LABELS: Record<FunnyTxType, string> = {
  charge: "충전",
  charge_bonus: "충전 보너스",
  grant: "관리자 지급",
  revoke: "관리자 회수",
  hold: "제작 예약",
  spend: "제작 사용",
  release: "예약 반환",
  refund: "환불",
};
