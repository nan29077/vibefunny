import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, StatCard, Card, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { statusLabel, statusTone, WALLET_TX_TYPE_LABELS } from "@/lib/labels";
import { displayName } from "@/lib/schema";
import { startSubscriptionAction } from "@/lib/actions/video-actions";
import { ReferralCard } from "@/components/referral-card";
import {
  IconFilm, IconMegaphone, IconDollarSign, IconTrendingUp,
  IconCheckCircle, IconBarChart, IconUsers, IconGlobe,
} from "@/components/icons";

const toneClass: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function CreatorDashboard() {
  const user = requireRole("creator");
  const db = getDb();

  const w = db.wallets.find((x) => x.user_id === user.id) ?? {
    pending_balance: 0, available_balance: 0, paid_balance: 0,
  };

  const myVideos      = db.videos.filter((v) => v.creator_id === user.id);
  const myApplications = db.campaign_applications.filter((a) => a.creator_id === user.id);
  const mySocials     = db.social_accounts.filter((s) => s.creator_id === user.id);
  const myPayouts     = db.payout_requests.filter((r) => r.user_id === user.id);

  // 최근 수익 거래 5건
  const recentTx = [...db.wallet_transactions]
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 영상 상태 분류
  const videoStats = {
    available:      myVideos.filter((v) => v.status === "available").length,
    pending_review: myVideos.filter((v) => v.status === "pending_review").length,
    sold:           myVideos.filter((v) => v.status === "sold").length,
    rejected:       myVideos.filter((v) => v.status === "rejected").length,
  };

  // 캠페인 상태 분류
  const campaignStats = {
    applied:  myApplications.filter((a) => a.status === "applied").length,
    approved: myApplications.filter((a) => a.status === "approved").length,
  };

  // 배포 완료 건수 & 수익
  const deliveries = db.campaign_deliveries.filter((d) => d.creator_id === user.id);
  const deliveryEarnings = deliveries.reduce((sum, d) => sum + d.reward_amount, 0);

  // 추천인 제도
  const referralEnabled = db.settings.referral_system_enabled;
  const referredCount   = db.referral_relations.filter(
    (r) => r.referrer_id === user.id && r.referral_type === "signup"
  ).length;
  const referralEarnings = db.wallet_transactions
    .filter((t) => t.user_id === user.id && t.type === "signup_referral")
    .reduce((sum, t) => sum + t.amount, 0);

  const subEnabled = db.settings.fees.creator.subscription_enabled;
  const subActive  = user.subscription_active_until
    && new Date(user.subscription_active_until) > new Date();

  const now = new Date();
  function daysAgo(iso: string) {
    const diff = now.getTime() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "오늘";
    if (days === 1) return "어제";
    return `${days}일 전`;
  }

  const totalEarnings = (w.available_balance ?? 0) + (w.pending_balance ?? 0) + (w.paid_balance ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${displayName(user)}님, 환영합니다!`}
        description={`오늘도 신나는 부업 시작! · 누적 수익 ${formatKRW(totalEarnings)}`}
      />

      {subEnabled && !subActive && (
        <Card className="border-brand-pink/40 bg-brand-pink/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-gray-800">구독이 필요합니다</div>
              <div className="text-sm text-gray-500">
                영상 등록·캠페인 참여를 위해 월 구독({formatKRW(db.settings.fees.creator.subscription_amount)})이 필요합니다.
              </div>
            </div>
            <form action={startSubscriptionAction}>
              <SubmitButton>구독하기</SubmitButton>
            </form>
          </div>
        </Card>
      )}

      {/* 수익 현황 4카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="지급 대기 수익" value={formatKRW(w.pending_balance)} accent="yellow" />
        <StatCard label="지급 가능 수익" value={formatKRW(w.available_balance)} accent="purple" />
        <StatCard label="지급 완료" value={formatKRW(w.paid_balance)} accent="gray" />
        <StatCard label="등록 영상" value={`${myVideos.length}개`} accent="pink" />
      </div>

      {/* 2열 섹션: 영상 현황 + 캠페인 현황 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 영상 상태별 */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconFilm size={15} className="text-brand-purple" />
              내 영상 현황
            </h3>
            <LinkButton href="/creator/videos" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "판매 중",     count: videoStats.available,      bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
              { label: "승인 대기",   count: videoStats.pending_review, bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
              { label: "판매 완료",   count: videoStats.sold,           bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
              { label: "반려됨",      count: videoStats.rejected,       bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
            ].map(({ label, count, bg, text, border }) => (
              <div key={label} className={`rounded-xl border ${border} ${bg} p-3 text-center`}>
                <div className={`text-2xl font-extrabold ${text}`}>{count}</div>
                <div className={`mt-0.5 text-xs font-semibold ${text}`}>{label}</div>
              </div>
            ))}
          </div>
          <LinkButton href="/creator/videos/new" size="sm" className="mt-4 w-full">+ 영상 등록하기</LinkButton>
        </Card>

        {/* 캠페인 & 배포 */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconMegaphone size={15} className="text-brand-pink" />
              캠페인 현황
            </h3>
            <LinkButton href="/creator/campaigns" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-3">
              <span className="text-sm text-purple-700">신청중 캠페인</span>
              <span className="font-extrabold text-purple-700">{campaignStats.applied}건</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
              <span className="text-sm text-green-700">승인된 캠페인</span>
              <span className="font-extrabold text-green-700">{campaignStats.approved}건</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
              <span className="text-sm text-blue-700">완료 배포 수익</span>
              <span className="font-extrabold text-blue-700">{formatKRW(deliveryEarnings)}</span>
            </div>
          </div>
          <LinkButton href="/creator/campaigns" size="sm" variant="outline" className="mt-4 w-full">캠페인 둘러보기</LinkButton>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 최근 수익 내역 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconDollarSign size={15} className="text-green-600" />
              최근 수익 내역
            </h3>
            <LinkButton href="/creator/wallet" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          {recentTx.length > 0 ? (
            <div className="space-y-2.5">
              {recentTx.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    t.amount >= 0 ? "bg-green-50" : "bg-red-50"
                  }`}>
                    <IconDollarSign size={13} className={t.amount >= 0 ? "text-green-500" : "text-red-500"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-gray-700">
                      {WALLET_TX_TYPE_LABELS[t.type] ?? t.type}
                    </div>
                    <div className="text-xs text-gray-400">{daysAgo(t.created_at)}</div>
                  </div>
                  <span className={`text-sm font-bold ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.amount >= 0 ? "+" : ""}{formatKRW(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">아직 수익 내역이 없습니다.</p>
          )}
        </Card>

        {/* SNS 채널 현황 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconGlobe size={15} className="text-blue-600" />
              연동 SNS 채널
            </h3>
            <LinkButton href="/creator/social" size="sm" variant="ghost">관리</LinkButton>
          </div>
          {mySocials.length > 0 ? (
            <div className="space-y-3">
              {mySocials.map((s) => {
                const platformColors: Record<string, string> = {
                  youtube: "bg-red-50 text-red-600 border-red-100",
                  instagram: "bg-pink-50 text-pink-600 border-pink-100",
                  tiktok: "bg-gray-50 text-gray-700 border-gray-200",
                };
                const platformLabels: Record<string, string> = {
                  youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok",
                };
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-bold ${platformColors[s.platform] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {platformLabels[s.platform] ?? s.platform}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-800">{s.account_name}</div>
                      <div className="text-xs text-gray-400">팔로워 {s.follower_count.toLocaleString("ko-KR")}명</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(s.verified_status)]}`}>
                      {statusLabel(s.verified_status)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">등록된 SNS 채널이 없습니다.</p>
              <LinkButton href="/creator/social" size="sm">채널 등록하기</LinkButton>
            </div>
          )}
          {mySocials.length > 0 && (
            <LinkButton href="/creator/social" size="sm" variant="outline" className="mt-3 w-full">채널 추가/관리</LinkButton>
          )}
        </Card>
      </div>

      {/* 출금 현황 */}
      {myPayouts.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconTrendingUp size={15} className="text-brand-purple" />
              출금 신청 내역
            </h3>
            <LinkButton href="/creator/wallet" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="space-y-2.5">
            {myPayouts.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneClass[statusTone(p.status)]}`}>
                  <IconCheckCircle size={13} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-700">{p.bank_name} · {p.account_holder}</div>
                  <div className="text-xs text-gray-400">{daysAgo(p.requested_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{formatKRW(p.amount)}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(p.status)]}`}>
                    {statusLabel(p.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 추천인 카드 */}
      {referralEnabled && (
        <ReferralCard
          referralCode={user.referral_code}
          referredCount={referredCount}
          referralEarnings={referralEarnings}
        />
      )}
    </div>
  );
}
