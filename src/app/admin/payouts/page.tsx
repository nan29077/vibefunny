import { getDb } from "@/lib/db";
import { Card, PageHeader, Table, Th, Td, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { nameOf } from "@/lib/queries";
import { WALLET_TX_TYPE_LABELS } from "@/lib/labels";
import { processPayoutAction, releaseWalletTxAction } from "@/lib/actions/admin-actions";

export default function AdminPayoutsPage() {
  const db = getDb();
  const payouts = [...db.payout_requests].sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));
  // 지급가능 처리 대기 중인 pending 수익(추천수당/캠페인 등)
  const pendingRewards = db.wallet_transactions.filter((t) => t.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader title="정산 / 출금 관리" description="수익 지급가능 전환 및 출금 신청 처리" />

      <Card>
        <h2 className="mb-3 text-base font-bold">지급가능 전환 대기 ({pendingRewards.length})</h2>
        {pendingRewards.length === 0 ? (
          <EmptyState title="대기 중인 수익이 없습니다" />
        ) : (
          <Table>
            <thead>
              <tr><Th>회원</Th><Th>유형</Th><Th>금액</Th><Th>메모</Th><Th>처리</Th></tr>
            </thead>
            <tbody>
              {pendingRewards.map((t) => (
                <tr key={t.id}>
                  <Td>{nameOf(db, t.user_id)}</Td>
                  <Td><Badge tone="yellow">{WALLET_TX_TYPE_LABELS[t.type]}</Badge></Td>
                  <Td>{formatKRW(t.amount)}</Td>
                  <Td className="text-gray-500">{t.memo ?? "-"}</Td>
                  <Td>
                    <form action={releaseWalletTxAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton size="sm">지급가능 처리</SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">출금 신청 ({payouts.length})</h2>
        {payouts.length === 0 ? (
          <EmptyState title="출금 신청이 없습니다" />
        ) : (
          <Table>
            <thead>
              <tr><Th>회원</Th><Th>금액</Th><Th>계좌</Th><Th>상태</Th><Th>처리</Th></tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <Td>{nameOf(db, p.user_id)}</Td>
                  <Td>{formatKRW(p.amount)}</Td>
                  <Td className="text-xs text-gray-500">{p.bank_name} {p.bank_account_number} ({p.account_holder})</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>
                    <div className="flex gap-1">
                      {p.status === "requested" && (
                        <>
                          <form action={processPayoutAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <SubmitButton size="sm">승인</SubmitButton>
                          </form>
                          <form action={processPayoutAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="decision" value="reject" />
                            <SubmitButton size="sm" variant="danger">반려</SubmitButton>
                          </form>
                        </>
                      )}
                      {p.status === "approved" && (
                        <form action={processPayoutAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="decision" value="paid" />
                          <SubmitButton size="sm">지급완료</SubmitButton>
                        </form>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
