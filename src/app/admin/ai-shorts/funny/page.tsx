import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { AdjustFunnyForm } from "@/components/ai-shorts/admin-forms";
import { FUNNY_TX_LABELS, formatFunny } from "@/lib/funny";
import { formatDateTime } from "@/lib/date";
import { displayName } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default function AdminFunnyPage() {
  requireAdmin();
  const db = getDb();
  const name = (id: string) => {
    const p = db.profiles.find((x) => x.id === id);
    return p ? `${displayName(p)} (${p.email})` : id;
  };
  const wallets = [...(db.funny_wallets ?? [])].sort((a, b) => b.paid_balance + b.bonus_balance - (a.paid_balance + a.bonus_balance));
  const txs = [...(db.funny_transactions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200);
  return (
    <div className="space-y-6">
      <PageHeader title="퍼니 관리" description="크리에이터 퍼니 잔액과 원장. 지급(보너스)·회수는 사유와 함께 감사 로그에 남습니다." />
      <Card>
        <h2 className="mb-3 text-base font-bold">퍼니 지급·회수</h2>
        <AdjustFunnyForm />
      </Card>
      <Card>
        <h2 className="mb-3 text-base font-bold">잔액 ({wallets.length}명)</h2>
        {wallets.length === 0 ? (
          <EmptyState title="퍼니 지갑이 없습니다" />
        ) : (
          <Table>
            <thead><tr><Th>크리에이터</Th><Th>충전 퍼니</Th><Th>보너스 퍼니</Th><Th>예약 중</Th></tr></thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.id}>
                  <Td className="text-xs">{name(w.user_id)}</Td>
                  <Td>{formatFunny(w.paid_balance)}</Td>
                  <Td>{formatFunny(w.bonus_balance)}</Td>
                  <Td>{formatFunny(w.held_paid + w.held_bonus)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 text-base font-bold">최근 원장 200건</h2>
        {txs.length === 0 ? (
          <EmptyState title="원장이 없습니다" />
        ) : (
          <Table>
            <thead><tr><Th>일시</Th><Th>크리에이터</Th><Th>구분</Th><Th>충전 변동</Th><Th>보너스 변동</Th><Th>예약 변동</Th><Th>사용</Th><Th>잔액(사용가능/예약)</Th><Th>내용</Th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <Td className="text-xs text-gray-500">{formatDateTime(t.created_at)}</Td>
                  <Td className="max-w-[180px] truncate text-xs">{name(t.user_id)}</Td>
                  <Td><Badge tone={t.type === "revoke" ? "red" : t.type === "spend" ? "purple" : "gray"}>{FUNNY_TX_LABELS[t.type]}</Badge></Td>
                  <Td className="text-xs">{t.paid_delta}</Td>
                  <Td className="text-xs">{t.bonus_delta}</Td>
                  <Td className="text-xs">{t.held_delta}</Td>
                  <Td className="text-xs">{t.charged || ""}</Td>
                  <Td className="text-xs">{(t.paid_after + t.bonus_after).toLocaleString()} / {t.held_after.toLocaleString()}</Td>
                  <Td className="max-w-[240px] truncate text-xs text-gray-500">{t.memo}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
