import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { getDb } from "@/lib/db";
import { Card, PageHeader, StatCard, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { PayoutForm } from "@/components/forms/payout-form";

export const dynamic = "force-dynamic";

export default function CreatorPointsPage() {
  const user = requireRole("creator");
  const db = getDb();

  // 지갑 잔액
  const wallet = db.wallets.find((w) => w.user_id === user.id);
  const availableBalance = wallet?.available_balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? 0;

  // 캠페인 수익 내역만 필터
  const campaignTxs = db.wallet_transactions
    .filter((t) => t.user_id === user.id && t.type === "campaign_reward")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const totalEarned = campaignTxs.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);

  // 캠페인 제목 조회용 맵
  const campaignMap: Record<string, string> = {};
  for (const c of db.ad_campaigns) {
    campaignMap[c.id] = c.title;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="포인트 / 캠페인 수익" description="캠페인 참여로 적립된 포인트와 출금 신청" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="누적 캠페인 수익" value={formatKRW(totalEarned)} accent="yellow" />
        <StatCard label="지급 대기" value={formatKRW(pendingBalance)} accent="gray" />
        <StatCard label="출금 가능" value={formatKRW(availableBalance)} accent="purple" />
      </div>

      <Card>
        <h2 className="mb-3 text-base font-bold">출금 신청</h2>
        {availableBalance === 0 ? (
          <p className="text-sm text-gray-500">출금 가능한 포인트가 없습니다. 캠페인에 참여하고 수익을 적립해보세요.</p>
        ) : (
          <PayoutForm available={availableBalance} />
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">캠페인 수익 내역</h2>
        {campaignTxs.length === 0 ? (
          <EmptyState title="캠페인 수익 내역이 없습니다" description="캠페인에 참여하고 배포 승인을 받으면 수익이 적립됩니다." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>캠페인</Th>
                <Th>금액</Th>
                <Th>상태</Th>
                <Th>적립일</Th>
              </tr>
            </thead>
            <tbody>
              {campaignTxs.map((t) => {
                const campaignTitle = t.related_id ? campaignMap[t.related_id] : null;
                return (
                  <tr key={t.id}>
                    <Td className="text-sm text-gray-700">
                      {t.memo ?? (campaignTitle ?? "-")}
                    </Td>
                    <Td className="font-semibold text-green-600">
                      +{formatKRW(t.amount)}
                    </Td>
                    <Td>
                      <Badge tone="green">적립 완료</Badge>
                    </Td>
                    <Td className="text-xs text-gray-400">
                      {formatDate(t.created_at)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="text-center text-sm text-gray-400">
        전체 수익/출금 내역은{" "}
        <a href="/creator/wallet" className="text-amber-600 underline font-semibold">
          수익 현황 페이지
        </a>
        에서 확인할 수 있습니다.
      </div>
    </div>
  );
}
