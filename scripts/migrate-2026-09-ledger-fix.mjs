// ===========================================================================
// 2026-09 데이터 정합성 보정 (1회성, 여러 번 실행해도 안전 — 멱등)
// ---------------------------------------------------------------------------
// 1) 출금 신청(payout_requests)과 수익 원장(payout 행) 연결 복구
//    - 원장 행 없이 승인된 출금 건: 지급가능 잔액을 묶고(-) 원장 행 생성
//      → 관리자가 "지급완료" 처리해도 같은 돈을 다시 출금할 수 없게 됨
//    - 과거 원장 보정(--apply)으로 "지급완료"로 잘못 기록된 신청중 출금 행을 신청 건에 재연결
// 2) 반려/취소/환불된 캠페인에 남아 있는 실행사 수수료(수익지갑)를 잔액과 함께 취소
//
// 사용:  node scripts/migrate-2026-09-ledger-fix.mjs          (미리보기, 변경 없음)
//        node scripts/migrate-2026-09-ledger-fix.mjs --apply  (백업 후 적용)
// ※ 적용 전 개발 서버를 잠시 멈추세요 (db.json 동시 쓰기 방지)
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const dbPath = path.join(process.cwd(), "data", "db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const now = new Date().toISOString();
const changes = [];
const unresolved = [];

const wallets = db.wallets ?? [];
const txs = db.wallet_transactions ?? [];
const walletOf = (userId) => wallets.find((w) => w.user_id === userId);

// --- 1) 출금 신청 ↔ 원장 연결 -----------------------------------------------
for (const pr of db.payout_requests ?? []) {
  const linked = txs.filter(
    (t) => t.type === "payout" && t.related_table === "payout_requests" && t.related_id === pr.id && t.status !== "cancelled"
  );
  if (linked.length > 0) continue;

  if (pr.status === "paid") {
    // 지급완료 건: 연결 안 된 동일 금액 지급 행이 있으면 연결만 한다
    const orphan = txs.find(
      (t) => t.type === "payout" && t.user_id === pr.user_id && t.amount === -pr.amount && t.status === "paid" &&
        t.related_table === "payout_requests" && !t.related_id
    );
    if (orphan) {
      orphan.related_id = pr.id;
      orphan.updated_at = now;
      changes.push({ payout: pr.id, action: "link_paid_row", tx: orphan.id });
    }
    continue;
  }

  if (pr.status !== "requested" && pr.status !== "approved") continue;
  const w = walletOf(pr.user_id);
  if (!w) {
    unresolved.push({ payout: pr.id, reason: "wallet_not_found" });
    continue;
  }

  // 과거 원장 보정 스크립트가 "지급완료"로 복구해 둔 행이 있으면 신청 건으로 재연결
  const reconRow = txs.find(
    (t) => t.type === "payout" && t.user_id === pr.user_id && t.amount === -pr.amount && t.status === "paid" &&
      t.related_table === "ledger_reconciliation"
  );
  if (reconRow && w.paid_balance >= pr.amount) {
    reconRow.related_table = "payout_requests";
    reconRow.related_id = pr.id;
    reconRow.status = "requested";
    reconRow.memo = "출금 신청 (원장 연결 복구)";
    reconRow.updated_at = now;
    w.paid_balance -= pr.amount; // 아직 지급되지 않은 금액이 지급완료로 잡혀 있던 것을 되돌림
    w.updated_at = now;
    changes.push({ payout: pr.id, action: "relink_reconciliation_row", tx: reconRow.id, paid_balance_minus: pr.amount });
    continue;
  }

  // 원장 행이 없고 잔액도 묶이지 않은 출금 건 → 지급가능 잔액을 묶고 원장 행 생성
  // 단, "저장된 지급가능 잔액 = 원장 기준 잔액"일 때만(= 아직 차감되지 않았다는 근거가 있을 때만) 자동 처리한다.
  // 이미 잔액에서 차감된 상태일 수 있는 애매한 건은 이중 차감을 막기 위해 unresolved 로 남겨 수동 확인한다.
  const userTxs = txs.filter((t) => t.user_id === pr.user_id);
  const earnedAvailable = userTxs.filter((t) => t.status === "available").reduce((s, t) => s + t.amount, 0);
  const reserved = -userTxs.filter((t) => t.type === "payout" && ["requested", "paid"].includes(t.status)).reduce((s, t) => s + t.amount, 0);
  const ledgerAvailable = earnedAvailable - reserved;
  if (w.available_balance !== ledgerAvailable) {
    unresolved.push({ payout: pr.id, reason: "ambiguous_balance_manual_check", stored_available: w.available_balance, ledger_available: ledgerAvailable, amount: pr.amount });
  } else if (w.available_balance >= pr.amount) {
    w.available_balance -= pr.amount;
    w.updated_at = now;
    const row = {
      id: randomUUID(), user_id: pr.user_id, type: "payout", amount: -pr.amount, status: "requested",
      related_table: "payout_requests", related_id: pr.id, memo: "출금 신청 (원장 누락 복구)",
      created_at: now, updated_at: now,
    };
    txs.push(row);
    changes.push({ payout: pr.id, action: "reserve_and_create_row", tx: row.id, available_minus: pr.amount });
  } else {
    unresolved.push({ payout: pr.id, reason: "insufficient_available_balance", available: w.available_balance, amount: pr.amount });
  }
}

// --- 2) 종료된 캠페인의 실행사 수수료(수익지갑) 취소 ----------------------------
const closed = new Set((db.ad_campaigns ?? []).filter((c) => ["rejected", "refunded", "cancelled"].includes(c.status)).map((c) => c.id));
for (const t of txs) {
  if (t.type !== "advertiser_commission" || !closed.has(t.related_id)) continue;
  if (t.status !== "pending" && t.status !== "available") continue;
  const w = walletOf(t.user_id);
  if (w) {
    if (t.status === "pending") w.pending_balance -= t.amount;
    else w.available_balance -= t.amount;
    w.updated_at = now;
  }
  changes.push({ commission_tx: t.id, action: "cancel_commission_of_closed_campaign", from: t.status, amount: t.amount });
  t.status = "cancelled";
  t.updated_at = now;
}

const report = { applied: process.argv.includes("--apply"), changes, unresolved };
if (report.applied && changes.length > 0) {
  db.audit_logs ??= [];
  db.audit_logs.push({
    id: randomUUID(), actor_id: null, action: "migration_2026_09_ledger_fix", target_table: "database",
    target_id: null, before_json: null, after_json: { changes: changes.length, unresolved }, created_at: now,
  });
  const backupPath = `${dbPath}.pre-migration-2026-09-${now.replace(/[:.]/g, "-")}.bak`;
  fs.copyFileSync(dbPath, backupPath);
  const tempPath = `${dbPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2));
  fs.renameSync(tempPath, dbPath);
  report.backup = backupPath;
}
console.log(JSON.stringify(report, null, 2));
