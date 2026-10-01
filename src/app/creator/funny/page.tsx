import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, StatCard, Table, Th, Td, EmptyState, Badge, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { chargeFunnyAction } from "@/lib/actions/funny-actions";
import { FUNNY_TX_LABELS, FUNNY_WON, formatFunny, funnyBalance } from "@/lib/funny";
import { aiShortsAccess, getAiShortsSettings } from "@/lib/ai/settings";
import { formatKRW } from "@/lib/money";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function CreatorFunnyPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = requireRole("creator");
  const db = getDb();
  const access = aiShortsAccess(db, user);
  const settings = getAiShortsSettings(db);
  const bal = funnyBalance(db, user.id);
  const txs = (db.funny_transactions ?? [])
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="퍼니 충전·내역"
        description="퍼니는 AI 숏츠 제작에 쓰는 크레딧입니다. 1퍼니 = 10원"
        action={<LinkButton href="/creator/ai-shorts" variant="outline" size="sm">AI 숏츠 만들기</LinkButton>}
      />

      {searchParams.error === "closed" && (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">{access.reason || "지금은 퍼니를 충전할 수 없습니다."}</Card>
      )}
      {searchParams.error === "amount" && (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">충전 금액은 1,000원 ~ 1,000,000원, 100원 단위로 입력해 주세요.</Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="사용 가능 퍼니" value={formatFunny(bal.available)} accent="purple" />
        <StatCard label="제작 중 예약" value={formatFunny(bal.held)} accent="yellow" />
        <StatCard label="그중 보너스" value={formatFunny(bal.bonus)} accent="gray" />
      </div>

      <Card>
        <h2 className="text-base font-bold">퍼니 충전</h2>
        {!access.open ? (
          <p className="mt-2 text-sm text-gray-500">{access.reason} 운영이 시작되면 충전할 수 있습니다. 남은 퍼니는 그대로 보관됩니다.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-gray-500">충전한 퍼니는 AI 숏츠 제작에만 쓸 수 있으며 현금으로 출금되지 않습니다. 보너스 퍼니부터 먼저 사용됩니다.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {settings.charge_products.map((p) => (
                <form key={p.id} action={chargeFunnyAction} className="rounded-2xl border border-gray-200 p-4 text-center">
                  <input type="hidden" name="product_id" value={p.id} />
                  <div className="text-lg font-extrabold text-gray-900">{formatFunny(p.won / FUNNY_WON)}</div>
                  {p.bonus > 0 ? <div className="text-xs font-semibold text-brand-purple">+ 보너스 {formatFunny(p.bonus)}</div> : <div className="text-xs text-gray-400">&nbsp;</div>}
                  <SubmitButton size="sm" className="mt-3 w-full">{formatKRW(p.won)}</SubmitButton>
                </form>
              ))}
            </div>
            <form action={chargeFunnyAction} className="mt-4 flex flex-wrap items-end gap-2">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">직접 입력 (원)</span>
                <input name="custom_won" type="number" min={1000} max={1000000} step={100} required placeholder="예: 20000" className="w-40 rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <SubmitButton variant="outline">충전하기</SubmitButton>
            </form>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">퍼니 내역</h2>
        {txs.length === 0 ? (
          <EmptyState title="아직 퍼니 내역이 없습니다" description="퍼니를 충전하고 AI 숏츠를 만들어 보세요." />
        ) : (
          <Table>
            <thead>
              <tr><Th>구분</Th><Th>변동</Th><Th>사용 가능 잔액</Th><Th>내용</Th><Th>일시</Th></tr>
            </thead>
            <tbody>
              {txs.map((t) => {
                const delta = t.paid_delta + t.bonus_delta;
                return (
                  <tr key={t.id}>
                    <Td><Badge tone={t.type === "spend" ? "purple" : t.type === "hold" ? "yellow" : t.type === "revoke" ? "red" : "green"}>{FUNNY_TX_LABELS[t.type]}</Badge></Td>
                    <Td className={delta >= 0 ? "text-green-600" : "text-red-500"}>
                      {t.type === "spend" ? `사용 ${formatFunny(t.charged)}` : `${delta >= 0 ? "+" : ""}${formatFunny(delta)}`}
                    </Td>
                    <Td>{formatFunny(t.paid_after + t.bonus_after)}</Td>
                    <Td className="max-w-[260px] truncate text-gray-500">{t.memo ?? "-"}</Td>
                    <Td className="text-xs text-gray-400">{formatDateTime(t.created_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
