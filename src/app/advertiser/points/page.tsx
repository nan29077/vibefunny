import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, StatCard, Table, Th, Td, EmptyState, Badge, Input } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatPoint } from "@/lib/money";
import { POINT_TX_TYPE_LABELS } from "@/lib/labels";
import { chargePointsAction } from "@/lib/actions/point-actions";

const PRESETS = [100000, 300000, 500000, 1000000];

export default function AdvertiserPointsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = requireRole("advertiser");
  const db = getDb();
  const pw = db.point_wallets.find((p) => p.advertiser_id === user.id);
  const balance = pw?.point_balance ?? 0;
  const txs = db.point_transactions
    .filter((t) => t.advertiser_id === user.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <div className="space-y-6">
      <PageHeader title="포인트" description="1P = 1원. 충전 후 캠페인 집행 시 차감됩니다." />

      {searchParams.error === "insufficient" && (
        <div className="rounded-xl bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          포인트가 부족합니다. 충전 후 다시 시도하세요.
        </div>
      )}

      <StatCard label="현재 포인트 잔액" value={formatPoint(balance)} accent="purple" />

      <Card>
        <h2 className="mb-3 text-base font-bold">포인트 충전</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((amt) => (
            <form key={amt} action={chargePointsAction}>
              <input type="hidden" name="preset" value={amt} />
              <SubmitButton variant="outline">{formatPoint(amt)}</SubmitButton>
            </form>
          ))}
        </div>
        <form action={chargePointsAction} className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">직접 입력(원)</label>
            <Input type="number" name="custom" min={1000} step={1000} placeholder="50000" className="max-w-xs" />
          </div>
          <SubmitButton>충전하기</SubmitButton>
        </form>
        <p className="mt-2 text-xs text-gray-400">최소 1,000원부터 충전 가능합니다.</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">충전/사용 내역</h2>
        {txs.length === 0 ? (
          <EmptyState title="포인트 내역이 없습니다" />
        ) : (
          <Table>
            <thead>
              <tr><Th>유형</Th><Th>변동</Th><Th>잔액</Th><Th>메모</Th><Th>일시</Th></tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
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
      </Card>
    </div>
  );
}
