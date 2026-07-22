import { getDb } from "@/lib/db";
import { PageHeader, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { formatPoint } from "@/lib/money";
import { nameOf } from "@/lib/queries";
import { POINT_TX_TYPE_LABELS } from "@/lib/labels";

export default function AdminPointsPage() {
  const db = getDb();
  const txs = [...db.point_transactions].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return (
    <div>
      <PageHeader title="포인트 충전/사용 내역" description="광고주 포인트 원장(ledger)" />
      {txs.length === 0 ? (
        <EmptyState title="포인트 내역이 없습니다" />
      ) : (
        <Table>
          <thead>
            <tr><Th>광고주</Th><Th>유형</Th><Th>변동</Th><Th>잔액</Th><Th>메모</Th><Th>일시</Th></tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id}>
                <Td>{nameOf(db, t.advertiser_id)}</Td>
                <Td><Badge tone={t.amount >= 0 ? "green" : "yellow"}>{POINT_TX_TYPE_LABELS[t.type]}</Badge></Td>
                <Td className={t.amount >= 0 ? "text-green-600" : "text-red-500"}>
                  {t.amount >= 0 ? "+" : ""}{formatPoint(t.amount)}
                </Td>
                <Td>{formatPoint(t.balance_after)}</Td>
                <Td className="text-gray-500">{t.memo ?? "-"}</Td>
                <Td className="text-xs text-gray-400">{t.created_at.slice(0, 16).replace("T", " ")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
