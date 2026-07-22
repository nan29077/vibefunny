import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { getDb } from "@/lib/db";
import { Card, PageHeader, Table, Th, Td, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { nameOf } from "@/lib/queries";

export default function AgenciesPage() {
  const user = requireRole("advertiser");
  const db = getDb();
  const rate = db.settings.advertiser_commission_rate;

  // ── 대행사 뷰: 상위 실행사 안내 ───────────────────────────────────────
  if (user.advertiser_type === "agency") {
    return (
      <div>
        <PageHeader title="소속 대행사" description="나를 추천한 실행사 정보" />
        {user.parent_advertiser_id ? (
          <Card>
            <p className="text-sm text-gray-600">
              상위 실행사: <b>{nameOf(db, user.parent_advertiser_id)}</b>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              나의 포인트 충전 시 관리자가 설정한 비율({rate}%)의 수수료가
              실행사 포인트 지갑에 적립됩니다.
            </p>
          </Card>
        ) : (
          <EmptyState
            title="연결된 상위 실행사가 없습니다"
            description="가입 시 실행사 추천 코드를 입력하면 연결됩니다."
          />
        )}
      </div>
    );
  }

  // ── 실행사 뷰: 소속 대행사 목록 + 수수료 내역 ─────────────────────────
  const agencies = db.profiles.filter(
    (p) => p.parent_advertiser_id === user.id && p.advertiser_type === "agency"
  );

  // 이 실행사가 받은 전체 commission point_tx
  const myCommissionTxs = db.point_transactions.filter(
    (t) => t.advertiser_id === user.id && t.type === "charge" &&
            t.memo?.includes("수수료 적립")
  );

  // 각 대행사의 결제 ID 목록 (payment_id 역추적용)
  const agencyPaymentIds = new Set(
    db.payments
      .filter((p) => agencies.some((a) => a.id === p.user_id) && p.payment_type === "point_charge")
      .map((p) => p.id)
  );

  // commission tx 중 대행사 결제에서 발생한 것만 (payment_id 기준)
  const commissionByAgency = Object.fromEntries(
    agencies.map((agency) => {
      const agencyPids = new Set(
        db.payments
          .filter((p) => p.user_id === agency.id && p.payment_type === "point_charge")
          .map((p) => p.id)
      );
      const txs = myCommissionTxs.filter((t) => t.payment_id && agencyPids.has(t.payment_id));
      const total = txs.reduce((s, t) => s + t.amount, 0);
      return [agency.id, { txs, total }];
    })
  );

  // 대행사별 포인트 충전 내역
  const chargesByAgency = Object.fromEntries(
    agencies.map((agency) => {
      const txs = db.point_transactions
        .filter((t) => t.advertiser_id === agency.id && t.type === "charge")
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return [agency.id, txs];
    })
  );

  const totalCommission = myCommissionTxs
    .filter((t) => t.payment_id && agencyPaymentIds.has(t.payment_id))
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="소속 대행사"
        description={`추천한 대행사와 수수료(충전액의 ${rate}%) 내역을 확인하세요.`}
      />

      <Card className="border-brand-purple/30 bg-brand-purple/5">
        <div className="text-sm text-gray-600">내 추천 코드 (대행사 가입 시 입력)</div>
        <div className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-brand-purple">
          {user.referral_code}
        </div>
        <div className="mt-2 text-xs text-gray-400">
          수수료율: <span className="font-semibold text-brand-purple">{rate}%</span>
          {" "}· 소속 대행사가 포인트를 충전할 때 해당 비율이 내 포인트 지갑에 자동 적립됩니다.
        </div>
      </Card>

      {agencies.length === 0 ? (
        <EmptyState
          title="아직 소속된 대행사가 없습니다"
          description="추천 코드를 공유해 대행사를 영입하세요."
        />
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">소속 대행사 ({agencies.length})</h2>
              <Badge tone="green">누적 수수료 포인트 {formatKRW(totalCommission)}</Badge>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>대행사</Th><Th>이메일</Th><Th>상태</Th><Th>가입일</Th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => (
                  <tr key={a.id}>
                    <Td>{a.name}</Td>
                    <Td className="text-gray-500">{a.email}</Td>
                    <Td><StatusBadge status={a.status} /></Td>
                    <Td className="text-xs text-gray-400">{formatDate(a.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {agencies.map((agency) => {
            const charges = chargesByAgency[agency.id] ?? [];
            const commission = commissionByAgency[agency.id] ?? { txs: [], total: 0 };
            return (
              <Card key={agency.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{agency.name} — 상세 내역</h3>
                  <Badge tone="purple">
                    수수료 적립 {formatKRW(commission.total)}
                  </Badge>
                </div>

                {/* 충전 내역 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    포인트 충전 내역
                  </p>
                  {charges.length === 0 ? (
                    <p className="text-sm text-gray-400">충전 내역이 없습니다.</p>
                  ) : (
                    <Table>
                      <thead>
                        <tr><Th>충전액</Th><Th>잔액</Th><Th>메모</Th><Th>일시</Th></tr>
                      </thead>
                      <tbody>
                        {charges.map((t) => (
                          <tr key={t.id}>
                            <Td className="text-blue-600">+{formatKRW(t.amount)}</Td>
                            <Td className="text-gray-500">{formatKRW(t.balance_after)}</Td>
                            <Td className="text-gray-500">{t.memo ?? "-"}</Td>
                            <Td className="text-xs text-gray-400">
                              {t.created_at.slice(0, 16).replace("T", " ")}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>

                {/* 수수료 적립 내역 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    이 대행사로 인한 수수료 적립 ({rate}%)
                  </p>
                  {commission.txs.length === 0 ? (
                    <p className="text-sm text-gray-400">아직 수수료 적립 내역이 없습니다.</p>
                  ) : (
                    <Table>
                      <thead>
                        <tr><Th>적립 포인트</Th><Th>메모</Th><Th>일시</Th></tr>
                      </thead>
                      <tbody>
                        {commission.txs.map((t) => (
                          <tr key={t.id}>
                            <Td className="text-green-600">+{formatKRW(t.amount)}</Td>
                            <Td className="text-gray-500">{t.memo ?? "-"}</Td>
                            <Td className="text-xs text-gray-400">
                              {t.created_at.slice(0, 16).replace("T", " ")}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
