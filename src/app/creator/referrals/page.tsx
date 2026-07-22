import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, StatCard, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { IconUsers, IconZap, IconClock } from "@/components/icons";
import { ROLE_LABELS } from "@/lib/schema";

export const dynamic = "force-dynamic";

const REWARD_STATUS_LABELS: Record<string, string> = {
  PENDING: "지급 대기",
  PAID: "지급 완료",
  CANCELLED: "취소됨",
};
const REWARD_STATUS_TONES: Record<string, "yellow" | "green" | "gray"> = {
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

export default function CreatorReferralsPage() {
  const user = requireRole("creator");
  const db = getDb();

  const referralEnabled = db.settings.referral_system_enabled;

  // 내 추천 코드로 가입한 사람 목록 (signup 타입만)
  const myRelations = db.referral_relations.filter(
    (r) => r.referrer_id === user.id && r.referral_type === "signup"
  );

  const myRewardMap = new Map(
    db.referral_rewards
      .filter((r) => r.referrer_id === user.id)
      .map((r) => [r.referee_id, r])
  );

  const totalCount = myRelations.length;
  const totalEarned = [...myRewardMap.values()].reduce((s, r) => s + r.amount, 0);
  const pendingAmount = [...myRewardMap.values()]
    .filter((r) => r.status === "PENDING")
    .reduce((s, r) => s + r.amount, 0);
  const paidAmount = [...myRewardMap.values()]
    .filter((r) => r.status === "PAID")
    .reduce((s, r) => s + r.amount, 0);

  // 테이블 행: referral_relations 기준으로 피추천인 정보 조인
  const rows = myRelations
    .map((rel) => {
      const referee = db.profiles.find((p) => p.id === rel.referee_id);
      const reward = myRewardMap.get(rel.referee_id);
      return { rel, referee, reward };
    })
    .sort(
      (a, b) =>
        new Date(b.rel.created_at).getTime() - new Date(a.rel.created_at).getTime()
    );

  if (!referralEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="내 추천인" description="추천인 제도 현황을 확인하세요." />
        <EmptyState
          title="추천인 제도가 비활성화됨"
          description="관리자가 추천인 제도를 활성화하면 이 페이지가 사용 가능합니다."
        />
      </div>
    );
  }

  const referralUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/signup?ref=${user.referral_code}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="내 추천인"
        description="내 추천 링크로 가입한 회원과 수당 현황입니다."
      />

      {/* 내 추천 링크 */}
      <Card>
        <h2 className="mb-3 font-bold text-gray-900 flex items-center gap-2">
          <IconZap size={15} className="text-purple-600" />
          내 추천 링크
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-purple-50 px-4 py-2.5 min-w-0">
            <span className="truncate font-mono text-sm text-purple-700">{referralUrl}</span>
          </div>
          <div className="rounded-xl bg-purple-100 px-4 py-2.5">
            <span className="font-bold text-purple-700">{user.referral_code}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          이 링크로 가입하면 자동으로 추천 관계가 등록되고, 역할별 수당이 지급됩니다.
        </p>
      </Card>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="총 추천 수" value={`${totalCount}명`} accent="purple" />
        <StatCard label="총 수당 금액" value={formatKRW(totalEarned)} accent="pink" />
        <StatCard label="미지급 수당" value={formatKRW(pendingAmount)} accent="yellow" />
        <StatCard label="지급 완료" value={formatKRW(paidAmount)} accent="gray" />
      </div>

      {/* 추천인 목록 */}
      <Card>
        <h2 className="mb-4 font-bold text-gray-900 flex items-center gap-2">
          <IconUsers size={15} className="text-purple-600" />
          추천인 목록
          {totalCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
              {totalCount}명
            </span>
          )}
        </h2>
        {rows.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>가입일</Th>
                <Th>이름</Th>
                <Th>역할</Th>
                <Th>수당 금액</Th>
                <Th>수당 상태</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ rel, referee, reward }) => (
                <tr key={rel.id}>
                  <Td>{formatDate(rel.created_at)}</Td>
                  <Td>
                    <div className="font-semibold text-gray-800">
                      {referee?.name ?? "알 수 없음"}
                    </div>
                    <div className="text-xs text-gray-400">{referee?.email ?? ""}</div>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-600">
                      {referee ? ROLE_LABELS[referee.role] : "-"}
                    </span>
                  </Td>
                  <Td>
                    {reward ? (
                      <span className="font-bold text-green-600">
                        {formatKRW(reward.amount)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">수당 없음</span>
                    )}
                  </Td>
                  <Td>
                    {reward ? (
                      <Badge tone={REWARD_STATUS_TONES[reward.status] ?? "gray"}>
                        {REWARD_STATUS_LABELS[reward.status] ?? reward.status}
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <IconClock size={11} />
                        -
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="추천인 없음"
            description="위 추천 링크를 공유하면 가입한 회원이 여기에 표시됩니다."
          />
        )}
      </Card>
    </div>
  );
}
