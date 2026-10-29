import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, StatCard, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { IconUsers, IconZap, IconClock } from "@/components/icons";
import { displayName } from "@/lib/schema";
import { canBeMentor, isVibeMember, GENERAL_MEMBER_LABEL, VIBE_MEMBER_LABEL } from "@/lib/membership";
import { LinkButton } from "@/components/ui";

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
  const totalEarned = [...myRewardMap.values()].filter((r) => r.status !== "CANCELLED").reduce((s, r) => s + r.amount, 0); // 취소된 수당 제외
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

  const referralUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/signup?role=creator&ref=${user.referral_code}`;
  // 멘토 자격: 바이브회원(가입비 결제 완료)만 추천 코드로 멘티를 받을 수 있다
  const mentor = canBeMentor(db, user);
  // 가입비를 실제로 결제한 멘티 (관리자 면제로 바이브회원이 된 멘티와 구분)
  const paidIds = new Set(db.payments.filter((x) => x.payment_type === "signup_fee" && x.status === "paid").map((x) => x.user_id));
  const paidCount = rows.filter((r) => r.referee && isVibeMember(db, r.referee) && paidIds.has(r.referee.id)).length;
  const exemptCount = rows.filter((r) => r.referee && isVibeMember(db, r.referee) && !paidIds.has(r.referee.id)).length;
  const unpaidCount = rows.filter((r) => r.referee && !isVibeMember(db, r.referee)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="내 멘티 현황"
        description="내 추천 코드로 가입한 멘티의 가입비 결제 여부와 수당 현황입니다."
      />

      {!mentor && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-amber-900">지금은 {GENERAL_MEMBER_LABEL}입니다</div>
              <div className="text-sm text-amber-800">가입비를 결제해 {VIBE_MEMBER_LABEL}이 되면 내 추천 코드로 멘티를 받을 수 있습니다.</div>
            </div>
            <LinkButton href="/payment/activate" size="sm">가입비 결제하기</LinkButton>
          </div>
        </Card>
      )}
      {mentor && !referralEnabled && (
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          현재 추천 수당 지급이 꺼져 있습니다. 멘티는 계속 받을 수 있지만, 멘티가 가입비를 결제해도 수당은 지급되지 않습니다.
        </div>
      )}

      {/* 내 추천 링크 (바이브회원만) */}
      {mentor && <Card>
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
          이 링크(또는 코드)로 가입하면 내 멘티로 등록됩니다. 멘티가 가입비를 결제해 {VIBE_MEMBER_LABEL}이 되면 추천 수당이 적립됩니다.
        </p>
      </Card>}

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 멘티" value={`${totalCount}명`} accent="purple" />
        <StatCard label={`결제 완료 (${VIBE_MEMBER_LABEL})`} value={exemptCount > 0 ? `${paidCount}명 (+면제 ${exemptCount}명)` : `${paidCount}명`} accent="pink" />
        <StatCard label={`결제 전 (${GENERAL_MEMBER_LABEL})`} value={`${unpaidCount}명`} accent="yellow" />
        <StatCard label="추천 수당 (총액)" value={formatKRW(totalEarned)} accent="gray" />
      </div>

      {/* 추천인 목록 */}
      <Card>
        <h2 className="mb-4 font-bold text-gray-900 flex items-center gap-2">
          <IconUsers size={15} className="text-purple-600" />
          멘티 목록
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
                <Th>가입비 결제</Th>
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
                      {referee ? displayName(referee) : "알 수 없음"}
                    </div>
                    <div className="text-xs text-gray-400">{referee?.email ?? ""}</div>
                  </Td>
                  <Td>
                    {referee && isVibeMember(db, referee) ? (
                      <div>
                        <Badge tone="green">{paidIds.has(referee.id) ? "결제 완료" : "가입비 면제"} · {VIBE_MEMBER_LABEL}</Badge>
                        {referee.vibe_member_at && <div className="mt-0.5 text-xs text-gray-400">바이브회원 전환 {formatDate(referee.vibe_member_at)}</div>}
                      </div>
                    ) : (
                      <Badge tone="yellow">결제 전 · {GENERAL_MEMBER_LABEL}</Badge>
                    )}
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
            title="아직 멘티가 없습니다"
            description={mentor ? "위 추천 링크를 공유하면 가입한 멘티가 여기에 표시됩니다." : `${VIBE_MEMBER_LABEL}이 되면 추천 코드로 멘티를 받을 수 있습니다.`}
          />
        )}
      </Card>
    </div>
  );
}
