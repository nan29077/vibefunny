import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { acquireLock, releaseLock } from "./lib/env-db.mjs";

const dbPath = path.join(process.cwd(), "data", "db.json");
// --apply 는 앱과 동시에 쓰지 않도록 db.lock 을 잡은 상태에서 읽고 쓴다
const applying = process.argv.includes("--apply");
const lockHandle = applying ? acquireLock() : null;
process.on("exit", () => { if (lockHandle !== null) releaseLock(lockHandle); });
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);

const walletRows = (db.wallets ?? []).map((wallet) => {
  const transactions = (db.wallet_transactions ?? []).filter((item) => item.user_id === wallet.user_id);
  const ledgerPending = sum(transactions.filter((item) => item.status === "pending"), (item) => item.amount);
  const ledgerEarnedAvailable = sum(transactions.filter((item) => item.status === "available"), (item) => item.amount);
  const reservedPayout = -sum(transactions.filter((item) => item.type === "payout" && ["requested", "paid"].includes(item.status)), (item) => item.amount);
  const paidPayout = -sum(transactions.filter((item) => item.type === "payout" && item.status === "paid"), (item) => item.amount);
  const ledgerAvailable = ledgerEarnedAvailable - reservedPayout;
  return {
    user_id: wallet.user_id,
    stored: { pending: wallet.pending_balance, available: wallet.available_balance, paid: wallet.paid_balance },
    ledger: { pending: ledgerPending, available: ledgerAvailable, paid: paidPayout },
    difference: {
      pending: wallet.pending_balance - ledgerPending,
      available: wallet.available_balance - ledgerAvailable,
      paid: wallet.paid_balance - paidPayout,
    },
  };
});

const pointRows = (db.point_wallets ?? []).map((wallet) => {
  const transactions = (db.point_transactions ?? []).filter((item) => item.advertiser_id === wallet.advertiser_id);
  const ledgerBalance = sum(transactions, (item) => item.amount);
  const latest = [...transactions].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  return {
    advertiser_id: wallet.advertiser_id,
    stored_balance: wallet.point_balance,
    ledger_balance: ledgerBalance,
    latest_balance_after: latest?.balance_after ?? 0,
    difference: wallet.point_balance - ledgerBalance,
  };
});

const duplicateRewards = Object.entries(
  (db.wallet_transactions ?? [])
    .filter((item) => !["payout", "adjustment"].includes(item.type) && item.status !== "cancelled" && item.related_table && item.related_id)
    .reduce((groups, item) => {
      const key = `${item.user_id}|${item.type}|${item.related_table}|${item.related_id}`;
      (groups[key] ??= []).push(item.id);
      return groups;
    }, {})
).filter(([, ids]) => ids.length > 1).map(([key, transaction_ids]) => ({ key, transaction_ids }));

// 출금 신청 ↔ 원장(payout 행) 연결 검사: 처리 대기/지급 건은 반드시 연결된 원장 행이 있어야 한다
const payoutLinkIssues = (db.payout_requests ?? [])
  .filter((pr) => ["requested", "approved", "paid"].includes(pr.status))
  .filter((pr) => !(db.wallet_transactions ?? []).some(
    (t) => t.type === "payout" && t.related_table === "payout_requests" && t.related_id === pr.id && t.status !== "cancelled"
  ))
  .map((pr) => ({ payout_request_id: pr.id, user_id: pr.user_id, status: pr.status, amount: pr.amount }));

// 퍼니(AI 숏츠 크레딧) 원장 검사: 잔액 = 원장 변동 합계, 예약 = 진행 중 작업의 예약 합계
const ACTIVE_JOB = ["queued", "running"];
const funnyRows = (db.funny_wallets ?? []).map((w) => {
  const txs = (db.funny_transactions ?? []).filter((t) => t.user_id === w.user_id);
  const paid = sum(txs, (t) => t.paid_delta);
  const bonus = sum(txs, (t) => t.bonus_delta);
  const held = sum(txs, (t) => t.held_delta);
  const jobsHeld = sum((db.ai_jobs ?? []).filter((j) => j.user_id === w.user_id && ACTIVE_JOB.includes(j.status)), (j) => j.hold_paid + j.hold_bonus);
  return {
    user_id: w.user_id,
    stored: { paid: w.paid_balance, bonus: w.bonus_balance, held: w.held_paid + w.held_bonus },
    ledger: { paid, bonus, held, active_jobs_held: jobsHeld },
    difference: { paid: w.paid_balance - paid, bonus: w.bonus_balance - bonus, held: w.held_paid + w.held_bonus - held, held_vs_jobs: w.held_paid + w.held_bonus - jobsHeld },
    negative: w.paid_balance < 0 || w.bonus_balance < 0 || w.held_paid < 0 || w.held_bonus < 0,
  };
});
// 결제 완료된 퍼니 충전이 원장에 정확히 1번 반영됐는지
const funnyChargeIssues = (db.payments ?? [])
  .filter((p) => p.payment_type === "funny_charge" && p.status === "paid")
  .map((p) => ({ payment_id: p.id, user_id: p.user_id, count: (db.funny_transactions ?? []).filter((t) => t.payment_id === p.id && t.type === "charge").length }))
  .filter((r) => r.count !== 1);

const report = {
  generated_at: new Date().toISOString(),
  source: dbPath,
  summary: {
    wallet_mismatches: walletRows.filter((row) => Object.values(row.difference).some((value) => value !== 0)).length,
    point_mismatches: pointRows.filter((row) => row.difference !== 0 || row.latest_balance_after !== row.stored_balance).length,
    duplicate_reward_groups: duplicateRewards.length,
    payout_link_issues: payoutLinkIssues.length,
    funny_mismatches: funnyRows.filter((r) => r.negative || Object.values(r.difference).some((v) => v !== 0)).length,
    funny_charge_issues: funnyChargeIssues.length,
  },
  wallets: walletRows,
  points: pointRows,
  duplicate_rewards: duplicateRewards,
  payout_link_issues: payoutLinkIssues,
  funny: funnyRows,
  funny_charge_issues: funnyChargeIssues,
};

if (process.argv.includes("--apply")) {
  const now = new Date().toISOString();
  const unresolved = [];
  for (const row of walletRows) {
    if (row.difference.pending > 0) {
      db.wallet_transactions.push({
        id: randomUUID(), user_id: row.user_id, type: "adjustment", amount: row.difference.pending,
        status: "pending", related_table: "ledger_reconciliation", related_id: `reconcile-${now}`,
        memo: "기존 대기 잔액 원장 복구", created_at: now, updated_at: now,
      });
    } else if (row.difference.pending < 0) unresolved.push({ user_id: row.user_id, field: "pending", difference: row.difference.pending });

    if (row.difference.paid > 0) {
      db.wallet_transactions.push({
        id: randomUUID(), user_id: row.user_id, type: "payout", amount: -row.difference.paid,
        status: "paid", related_table: "ledger_reconciliation", related_id: `reconcile-${now}`,
        memo: "기존 지급 완료 잔액 원장 복구", created_at: now, updated_at: now,
      });
    } else if (row.difference.paid < 0) unresolved.push({ user_id: row.user_id, field: "paid", difference: row.difference.paid });

    const availableAdjustment = row.difference.available + Math.max(0, row.difference.paid);
    if (availableAdjustment > 0) {
      db.wallet_transactions.push({
        id: randomUUID(), user_id: row.user_id, type: "adjustment", amount: availableAdjustment,
        status: "available", related_table: "ledger_reconciliation", related_id: `reconcile-${now}`,
        memo: "기존 지급 가능 잔액 원장 복구", created_at: now, updated_at: now,
      });
    } else if (availableAdjustment < 0) unresolved.push({ user_id: row.user_id, field: "available", difference: availableAdjustment });
  }

  for (const row of pointRows) {
    if (row.difference !== 0) {
      db.point_transactions.push({
        id: randomUUID(), advertiser_id: row.advertiser_id, type: "adjustment", amount: row.difference,
        balance_after: row.stored_balance, payment_id: null, campaign_id: null,
        memo: "기존 포인트 잔액 원장 복구", created_at: now,
      });
    }
  }
  db.audit_logs ??= [];
  db.audit_logs.push({
    id: randomUUID(), actor_id: null, action: "ledger_reconciliation", target_table: "database",
    target_id: null, before_json: report.summary, after_json: { unresolved }, created_at: now,
  });

  const backupPath = `${dbPath}.pre-reconciliation-${now.replace(/[:.]/g, "-")}.bak`;
  const tempPath = `${dbPath}.${process.pid}.tmp`;
  fs.copyFileSync(dbPath, backupPath);
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2));
  fs.renameSync(tempPath, dbPath);
  console.error(JSON.stringify({ applied: true, backup: backupPath, unresolved }, null, 2));
  process.exitCode = unresolved.length ? 3 : 0;
} else if (report.summary.wallet_mismatches || report.summary.point_mismatches || report.summary.duplicate_reward_groups || report.summary.payout_link_issues || report.summary.funny_mismatches || report.summary.funny_charge_issues) {
  process.exitCode = 2;
}

console.log(JSON.stringify(report, null, 2));
