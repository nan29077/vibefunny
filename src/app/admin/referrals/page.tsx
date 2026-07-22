import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  Card, PageHeader, StatCard, Badge, Table, Th, Td, EmptyState,
} from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import {
  payReferralRewardAction,
  cancelReferralRewardAction,
} from "@/lib/actions/admin-actions";
import { IconUsers, IconCheckCircle, IconX, IconChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "지급 대기",
  PAID: "지급 완료",
  CANCELLED: "취소됨",
};
const STATUS_TONES: Record<string, "yellow" | "green" | "gray"> = {
  PENDING: "yellow",
  PAID: "green",
  CANCELLED: "gray",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function AdminReferralsPage() {
  requireAdmin();
  const db = getDb();

  const rewards = [...db.referral_rewards].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const pending = rewards.filter((r) => r.status === "PENDING");
  const paid = rewards.filter((r) => r.status === "PAID");
  const cancelled = rewards.filter((r) => r.status === "CANCELLED");

  const totalPendingAmount = pending.reduce((s, r) => s + r.amount, 0);
  const totalPaidAmount = paid.reduce((s, r) => s + r.amount, 0);

  // 추천 관계 (signup 타입)
  const signupRelations = db.referral_relations.filter(
    (r) => r.referral_type === "signup"
  );

  function getProfile(id: string) {
    return db.profiles.find((p) => p.id === id);
  }

  // 크리에이터별 추천 트리 구성
  const creatorMap = new Map<
    string,
    {
      referrer: (typeof db.profiles)[0];
      referees: Array<{
        profile: (typeof db.profiles)[0] | undefined;
        reward: (typeof db.referral_rewards)[0] | undefined;
        joinedAt: string;
      }>;
      totalReward: number;
    }
  >();

  for (const rel of signupRelations) {
    const referrer = getProfile(rel.referrer_id);
    if (!referrer) continue;
    if (!creatorMap.has(rel.referrer_id)) {
      creatorMap.set(rel.referrer_id, {
        referrer,
        referees: [],
        totalReward: 0,
      });
    }
    const entry = creatorMap.get(rel.referrer_id)!;
    const referee = getProfile(rel.referee_id);
    const reward = db.referral_rewards.find(
      (rw) => rw.referrer_id === rel.referrer_id && rw.referee_id === rel.referee_id
    );
    entry.referees.push({ profile: referee, reward, joinedAt: rel.created_at });
    if (reward) entry.totalReward += reward.amount;
  }

  const creatorTree = [...creatorMap.values()].sort(
    (a, b) => b.referees.length - a.referees.length
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="추천인 수당 관리"
        description="추천인 관계, 수당 지급 현황을 관리합니다."
      />

      {/* 상단 통계 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="총 추천 관계 수"
          value={`${signupRelations.length}건`}
          accent="purple"
        />
        <StatCard
          label="지급 대기 (건)"
          value={`${pending.length}건`}
          accent="yellow"
        />
        <StatCard
          label="미지급 수당 합계"
          value={formatKRW(totalPendingAmount)}
          accent="pink"
        />
        <StatCard
          label="지급 완료 합계"
          value={formatKRW(totalPaidAmount)}
          accent="gray"
        />
      </div>

      {/* 추천 트리: 크리에이터별 그룹 */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <IconUsers size={15} className="text-purple-500" />
          추천 트리 (크리에이터별)
        </h2>
        {creatorTree.length > 0 ? (
          <div className="space-y-3">
            {creatorTree.map(({ referrer, referees, totalReward }) => (
              <details key={referrer.id} className="group rounded-xl border border-gray-200 overflow-hidden">
                <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 list-none">
                  <IconChevronRight
                    size={14}
                    className="shrink-0 text-gray-400 transition-transform group-open:rotate-90"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-800">{referrer.name}</div>
                    <div className="text-xs text-gray-400">{referrer.email}</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      직접 추천{" "}
                      <span className="font-bold text-gray-800">{referees.length}명</span>
                    </span>
                    <span className="text-gray-500">
                      총 수당{" "}
                      <span className="font-bold text-green-600">
                        {formatKRW(totalReward)}
                      </span>
                    </span>
                  </div>
                </summary>
                <div className="border-t border-gray-100 px-4 py-2">
                  {referees.length > 0 ? (
                    <Table>
                      <thead>
                        <tr>
                          <Th>가입일</Th>
                          <Th>이름</Th>
                          <Th>수당 금액</Th>
                          <Th>수당 상태</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {referees
                          .sort(
                            (a, b) =>
                              new Date(b.joinedAt).getTime() -
                              new Date(a.joinedAt).getTime()
                          )
                          .map(({ profile, reward, joinedAt }) => (
                            <tr key={`${referrer.id}-${profile?.id ?? joinedAt}`}>
                              <Td>{formatDate(joinedAt)}</Td>
                              <Td>
                                <div className="font-semibold text-gray-800">
                                  {profile?.name ?? "알 수 없음"}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {profile?.email ?? ""}
                                </div>
                              </Td>
                              <Td>
                                {reward ? (
                                  <span className="font-bold text-green-600">
                                    {formatKRW(reward.amount)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">없음</span>
                                )}
                              </Td>
                              <Td>
                                {reward ? (
                                  <Badge tone={STATUS_TONES[reward.status] ?? "gray"}>
                                    {STATUS_LABELS[reward.status] ?? reward.status}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </Td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p className="py-2 text-sm text-gray-400">추천인 없음</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <EmptyState
            title="추천 관계 없음"
            description="아직 등록된 추천 관계가 없습니다."
          />
        )}
      </Card>

      {/* 미지급 수당 */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <IconUsers size={15} className="text-yellow-500" />
          지급 대기 수당
          {pending.length > 0 && (
            <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>생성일</Th>
                <Th>추천인</Th>
                <Th>피추천인</Th>
                <Th>수당 금액</Th>
                <Th>처리</Th>
              </tr>
            </thead>
            <tbody>
              {pending.map((rw) => {
                const referrer = getProfile(rw.referrer_id);
                const referee = getProfile(rw.referee_id);
                return (
                  <tr key={rw.id}>
                    <Td>{formatDate(rw.created_at)}</Td>
                    <Td>
                      <div className="font-semibold text-gray-800">
                        {referrer?.name ?? "-"}
                      </div>
                      <div className="text-xs text-gray-400">{referrer?.email ?? ""}</div>
                    </Td>
                    <Td>
                      <div className="font-semibold text-gray-800">
                        {referee?.name ?? "-"}
                      </div>
                      <div className="text-xs text-gray-400">{referee?.email ?? ""}</div>
                    </Td>
                    <Td>
                      <span className="font-bold text-green-600">
                        {formatKRW(rw.amount)}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <form action={payReferralRewardAction}>
                          <input type="hidden" name="id" value={rw.id} />
                          <SubmitButton size="sm">
                            <IconCheckCircle size={13} />
                            지급 완료
                          </SubmitButton>
                        </form>
                        <form action={cancelReferralRewardAction}>
                          <input type="hidden" name="id" value={rw.id} />
                          <SubmitButton size="sm" variant="danger">
                            <IconX size={13} />
                            취소
                          </SubmitButton>
                        </form>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="지급 대기 수당 없음"
            description="현재 처리할 수당이 없습니다."
          />
        )}
      </Card>

      {/* 처리 완료 내역 */}
      {(paid.length > 0 || cancelled.length > 0) && (
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
            <IconCheckCircle size={15} className="text-green-500" />
            처리 완료 내역
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>생성일</Th>
                <Th>추천인</Th>
                <Th>피추천인</Th>
                <Th>수당 금액</Th>
                <Th>상태</Th>
                <Th>처리일</Th>
              </tr>
            </thead>
            <tbody>
              {[...paid, ...cancelled]
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((rw) => {
                  const referrer = getProfile(rw.referrer_id);
                  const referee = getProfile(rw.referee_id);
                  return (
                    <tr key={rw.id}>
                      <Td>{formatDate(rw.created_at)}</Td>
                      <Td>
                        <div className="font-semibold text-gray-800">
                          {referrer?.name ?? "-"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {referrer?.email ?? ""}
                        </div>
                      </Td>
                      <Td>
                        <div className="font-semibold text-gray-800">
                          {referee?.name ?? "-"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {referee?.email ?? ""}
                        </div>
                      </Td>
                      <Td>
                        <span className="font-bold text-gray-700">
                          {formatKRW(rw.amount)}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONES[rw.status] ?? "gray"}>
                          {STATUS_LABELS[rw.status] ?? rw.status}
                        </Badge>
                      </Td>
                      <Td>{rw.paid_at ? formatDate(rw.paid_at) : "-"}</Td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
