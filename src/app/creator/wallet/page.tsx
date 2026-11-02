import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/date";
import { getDb } from "@/lib/db";
import { Card, PageHeader, StatCard, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { CREATOR_WALLET_TX_TYPE_LABELS, payoutStatusLabel, walletTxStatusLabel } from "@/lib/labels";
import { PayoutForm } from "@/components/forms/payout-form";
import { maskBankAccount } from "@/lib/crypto";
import { VibeOnlyNotice } from "@/components/membership/vibe-only-notice";
import { isVibeMember } from "@/lib/membership";
import { DEFAULT_MIN_PAYOUT } from "@/lib/schema";

export default function CreatorWalletPage() {
  const user = requireRole("creator");
  const db = getDb();
  const w = db.wallets.find((x) => x.user_id === user.id) ?? {
    pending_balance: 0,
    available_balance: 0,
    paid_balance: 0,
  };
  const txs = db.wallet_transactions
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const payouts = db.payout_requests
    .filter((p) => p.user_id === user.id)
    .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));

  return (
    <div className="space-y-6">
      <PageHeader title="수익 / 출금" description="정산 현황과 출금 신청" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="지급 대기" value={formatKRW(w.pending_balance)} accent="yellow" />
        <StatCard label="지급 가능" value={formatKRW(w.available_balance)} accent="purple" />
        <StatCard label="지급 완료" value={formatKRW(w.paid_balance)} accent="gray" />
      </div>

      <Card>
        <h2 className="mb-3 text-base font-bold">출금 신청</h2>
        {isVibeMember(db, user) ? (
          <PayoutForm available={w.available_balance} minPayout={db.settings.min_payout_amount ?? DEFAULT_MIN_PAYOUT} />
        ) : (
          <VibeOnlyNotice feature="출금 신청" signupFee={db.settings.fees.creator.signup_fee_amount} compact />
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">정산 내역</h2>
        {txs.length === 0 ? (
          <EmptyState title="정산 내역이 없습니다" />
        ) : (
          <Table>
            <thead>
              <tr><Th>유형</Th><Th>금액</Th><Th>상태</Th><Th>메모</Th><Th>일시</Th></tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <Td><Badge tone="purple">{CREATOR_WALLET_TX_TYPE_LABELS[t.type]}</Badge></Td>
                  <Td className={t.amount >= 0 ? "text-green-600" : "text-red-500"}>
                    {t.amount >= 0 ? "+" : ""}{formatKRW(t.amount)}
                  </Td>
                  <Td><Badge tone={walletTxStatusLabel(t.status).tone}>{walletTxStatusLabel(t.status).label}</Badge></Td>
                  <Td className="text-gray-500">{t.memo ?? "-"}</Td>
                  <Td className="text-xs text-gray-400">{formatDateTime(t.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {payouts.length > 0 && (
        <Card>
          <h2 className="mb-3 text-base font-bold">출금 신청 내역</h2>
          <Table>
            <thead>
              <tr><Th>금액</Th><Th>계좌</Th><Th>상태</Th><Th>신청일</Th></tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <Td>{formatKRW(p.amount)}</Td>
                  <Td className="text-xs text-gray-500">{p.bank_name} {maskBankAccount(p.bank_account_number)}</Td>
                  <Td><Badge tone={payoutStatusLabel(p.status).tone}>{payoutStatusLabel(p.status).label}</Badge></Td>
                  <Td className="text-xs text-gray-400">{formatDate(p.requested_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
