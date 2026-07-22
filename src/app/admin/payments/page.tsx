import { getDb } from "@/lib/db";
import { PageHeader, Table, Th, Td, StatusBadge, EmptyState } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { nameOf } from "@/lib/queries";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";

export default function AdminPaymentsPage() {
  const db = getDb();
  const payments = [...db.payments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return (
    <div>
      <PageHeader title="결제 내역 관리" description="전체 결제 트랜잭션" />
      {payments.length === 0 ? (
        <EmptyState title="결제 내역이 없습니다" />
      ) : (
        <Table>
          <thead>
            <tr><Th>회원</Th><Th>유형</Th><Th>금액</Th><Th>상태</Th><Th>프로바이더</Th><Th>일시</Th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td>{nameOf(db, p.user_id)}</Td>
                <Td>{PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type}</Td>
                <Td>{formatKRW(p.amount)}</Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td className="text-gray-500">{p.provider}</Td>
                <Td className="text-xs text-gray-400">{p.created_at.slice(0, 16).replace("T", " ")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
