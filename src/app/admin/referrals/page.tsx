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
  createMissingReferralRewardAction,
} from "@/lib/actions/admin-actions";
import Link from "next/link";
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

export default function AdminReferralsPage({ searchParams }: { searchParams?: { notice?: string; tone?: string } }) {
  const admin = requireAdmin();
  const db = getDb();
  const notice = searchParams?.notice;
  const referralOn = db.settings.referral_system_enabled;
  const creatorRewardAmount = db.settings.fees.creator?.referral_reward_amount ?? 0;
  // 가입비를 결제했는데 수당 기록이 없는 멘티 (추천인 제도가 꺼져 있을 때 결제 등) — 관리자가 소급 생성할 수 있다
  const paidUserIds = new Set(db.payments.filter((p) => p.payment_type === "signup_fee" && p.status === "paid").map((p) => p.user_id));
  const missingRewards = db.profiles
    .filter((p) => p.role === "creator" && p.referred_by_user_id && paidUserIds.has(p.id))
    .map((p) => ({ referee: p, mentor: db.profiles.find((m) => m.id === p.referred_by_user_id) }))
    .filter(({ referee, mentor }) => mentor && mentor.role === "creator" && !db.referral_rewards.some((r) => r.referee_id === referee.id && r.referrer_id === mentor.id));

  const rewards = [...db.referral_rewards].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const pending = rewards.filter((r) => r.status === "PENDING");
  const paid = rewards.filter((r) => r.status === "PAID");
  const cancelled = rewards.filter((r) => r.status === "CANCELLED");

  const totalPendingAmount = pending.reduce((s, r) => s + r.amount, 0);
  const totalPaidAmount = paid.reduce((s, r) => s + r.amount, 0);

  // 추천 관계 (signup 타입)
  // 크리에이터 멘토-멘티 관계만 (예전 데이터의 광고주 추천 기록은 제외 — 광고주 계층은 실행사 '소속 대행사'에서 관리)
  const signupRelations = db.referral_relations.filter(
    (r) => r.referral_type === "signup" && db.profiles.find((p) => p.id === r.referee_id)?.role === "creator"
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
    if (reward && reward.status !== "CANCELLED") entry.totalReward += reward.amount;
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

      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${searchParams?.tone === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`} role={searchParams?.tone === "error" ? "alert" : "status"}>{notice}</div>
      )}
      {!referralOn && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          현재 <b>추천인 제도(수당 지급)가 꺼져 있습니다.</b> 멘티가 가입비를 결제해도 수당이 자동으로 생기지 않습니다.{" "}
          <Link href="/admin/settings" className="font-semibold underline">정책 설정에서 켜기</Link>
        </div>
      )}

      {/* 회사 추천 코드: 크리에이터는 추천인 코드가 있어야 가입할 수 있으므로, 추천인이 없는 지원자에게 이 코드를 안내 */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-gray-900">회사 추천 코드</div>
            <div className="text-sm text-gray-500">크리에이터는 바이브회원의 추천 코드가 있어야 가입할 수 있습니다. 추천인이 없는 지원자(또는 첫 회원)에게는 이 코드를 안내하세요. 이 코드로 가입한 회원의 추천 수당은 발생하지 않습니다.</div>
          </div>
          <div className="rounded-xl bg-purple-100 px-4 py-2.5 font-mono text-lg font-bold text-purple-700">{admin.referral_code}</div>
        </div>
      </Card>

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

      {/* 결제했지만 수당 기록이 없는 멘티 */}
      {missingRewards.length > 0 && (
        <Card>
          <h2 className="mb-1 font-bold text-gray-900">수당 미생성 멘티 ({missingRewards.length})</h2>
          <p className="mb-3 text-sm text-gray-500">가입비를 결제했지만 추천 수당이 생성되지 않은 멘티입니다(추천인 제도가 꺼져 있을 때 결제 등). 필요하면 현재 정책 금액({formatKRW(creatorRewardAmount)})으로 수당을 생성할 수 있습니다.</p>
          <Table>
            <thead><tr><Th>멘티</Th><Th>멘토</Th><Th>처리</Th></tr></thead>
            <tbody>
              {missingRewards.map(({ referee, mentor }) => (
                <tr key={referee.id}>
                  <Td><div className="font-semibold text-gray-800">{referee.name}</div><div className="text-xs text-gray-400">{referee.email}</div></Td>
                  <Td><div className="font-semibold text-gray-800">{mentor?.name}</div><div className="text-xs text-gray-400">{mentor?.email}</div></Td>
                  <Td>
                    <form action={createMissingReferralRewardAction}>
                      <input type="hidden" name="referee_id" value={referee.id} />
                      <SubmitButton size="sm" confirmMessage={`${mentor?.name}님에게 추천 수당 ${formatKRW(creatorRewardAmount)}(지급 대기)을 생성할까요?`}>수당 생성</SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

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
