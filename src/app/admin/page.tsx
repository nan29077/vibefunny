import { PageHeader, StatCard, Card, LinkButton } from "@/components/ui";
import { adminStats } from "@/lib/queries";
import { formatKRW, formatPoint } from "@/lib/money";
import { getDb } from "@/lib/db";
import { statusLabel, statusTone, CAMPAIGN_TYPE_LABELS, POINT_TX_TYPE_LABELS } from "@/lib/labels";
import {
  IconUsers, IconFilm, IconMegaphone, IconBarChart,
  IconShield, IconCheckCircle, IconTrendingUp, IconDollarSign,
  IconCreditCard, IconClipboard, IconBuilding, IconZap,
} from "@/components/icons";

const toneClass: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function AdminDashboard() {
  const s = adminStats();
  const db = getDb();

  // 최근 가입 회원 5명
  const recentMembers = [...db.profiles]
    .filter((p) => p.role !== "admin")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 처리 대기 항목
  const pendingVideos    = db.videos.filter((v) => v.status === "pending_review");
  const pendingCampaigns = db.ad_campaigns.filter((c) => c.status === "admin_review");
  const pendingPayouts   = db.payout_requests.filter((r) => ["requested","approved"].includes(r.status));
  const pendingPayoutAmt = pendingPayouts.filter((r) => r.status === "requested").reduce((sum, r) => sum + r.amount, 0);

  // 최근 캠페인 5건
  const recentCampaigns = [...db.ad_campaigns]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 플랫폼별 캠페인 수
  const platformCount: Record<string, number> = { youtube: 0, instagram: 0, tiktok: 0 };
  db.ad_campaigns.forEach((c) => c.platforms.forEach((p) => { platformCount[p] = (platformCount[p] ?? 0) + 1; }));

  // 수익 요약
  const totalCreatorEarnings = db.wallet_transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPointCharged = db.point_transactions
    .filter((t) => t.type === "charge")
    .reduce((sum, t) => sum + t.amount, 0);

  const roleLabelMap: Record<string, string> = {
    creator: "크리에이터", advertiser: "광고주",
  };

  const now = new Date();
  function daysAgo(iso: string) {
    const diff = now.getTime() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "오늘";
    if (days === 1) return "어제";
    return `${days}일 전`;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="관리자 대시보드" description="플랫폼 전체 현황을 한눈에 확인하세요." />

      {/* 처리 대기 알림 */}
      {(pendingVideos.length > 0 || pendingCampaigns.length > 0 || pendingPayouts.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {pendingVideos.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
              <IconFilm size={18} className="shrink-0 text-yellow-600" />
              <div className="flex-1">
                <div className="text-sm font-bold text-yellow-800">영상 승인 대기</div>
                <div className="text-xs text-yellow-600">{pendingVideos.length}건 처리 필요</div>
              </div>
              <LinkButton href="/admin/videos" size="sm" variant="outline">처리</LinkButton>
            </div>
          )}
          {pendingCampaigns.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
              <IconMegaphone size={18} className="shrink-0 text-purple-600" />
              <div className="flex-1">
                <div className="text-sm font-bold text-purple-800">캠페인 검토 대기</div>
                <div className="text-xs text-purple-600">{pendingCampaigns.length}건 심사 필요</div>
              </div>
              <LinkButton href="/admin/campaigns" size="sm" variant="outline">처리</LinkButton>
            </div>
          )}
          {pendingPayouts.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <IconDollarSign size={18} className="shrink-0 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-bold text-green-800">출금 신청</div>
                <div className="text-xs text-green-600">{pendingPayouts.length}건 · {formatKRW(pendingPayoutAmt)}</div>
              </div>
              <LinkButton href="/admin/payouts" size="sm" variant="outline">처리</LinkButton>
            </div>
          )}
        </div>
      )}

      {/* 회원 통계 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconUsers size={16} className="text-brand-purple" />
          회원 현황
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="총 회원 수" value={`${s.totalMembers}명`} accent="purple" />
          <StatCard label="크리에이터" value={`${s.creators}명`} accent="pink" />
          <StatCard label="광고주" value={`${s.advertisers}명`} accent="gray" />
        </div>
      </div>

      {/* 콘텐츠 & 광고 통계 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconFilm size={16} className="text-brand-pink" />
          콘텐츠 & 광고
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="판매중 영상" value={`${s.videosForSale}개`} accent="purple" />
          <StatCard label="승인대기 영상" value={`${pendingVideos.length}개`} accent="yellow" />
          <StatCard label="진행중 캠페인" value={`${s.activeCampaigns}개`} accent="pink" />
          <StatCard label="검토대기 캠페인" value={`${pendingCampaigns.length}개`} accent="gray" />
        </div>
      </div>

      {/* 재무 현황 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconBarChart size={16} className="text-green-600" />
          재무 현황
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="광고주 포인트 충전" value={formatKRW(totalPointCharged)} accent="purple" />
          <StatCard label="광고 총 집행액" value={formatKRW(s.totalAdSpend)} accent="pink" />
          <StatCard label="크리에이터 수익 합산" value={formatKRW(totalCreatorEarnings)} accent="yellow" />
          <StatCard label="정산 대기 금액" value={formatKRW(s.pendingPayout)} accent="gray" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 최근 가입 회원 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconUsers size={15} className="text-brand-purple" />
              최근 가입 회원
            </h3>
            <LinkButton href="/admin/members" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="space-y-2.5">
            {recentMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-pink text-xs font-bold text-white">
                  {m.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{m.name}</div>
                  <div className="text-xs text-gray-400">{m.email}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(m.status)]}`}>
                    {roleLabelMap[m.role] ?? m.role}
                  </span>
                  <span className="text-xs text-gray-400">{daysAgo(m.created_at)}</span>
                </div>
              </div>
            ))}
            {recentMembers.length === 0 && (
              <p className="text-sm text-gray-400">등록된 회원이 없습니다.</p>
            )}
          </div>
        </Card>

        {/* 최근 캠페인 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconMegaphone size={15} className="text-brand-pink" />
              최근 캠페인
            </h3>
            <LinkButton href="/admin/campaigns" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="space-y-2.5">
            {recentCampaigns.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-50">
                  <IconMegaphone size={14} className="text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{c.title}</div>
                  <div className="text-xs text-gray-400">{CAMPAIGN_TYPE_LABELS[c.campaign_type]} · {formatKRW(c.total_cost)}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(c.status)]}`}>
                  {statusLabel(c.status)}
                </span>
              </div>
            ))}
            {recentCampaigns.length === 0 && (
              <p className="text-sm text-gray-400">등록된 캠페인이 없습니다.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 광고주 구성 */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
            <IconBuilding size={15} className="text-brand-purple" />
            광고주 구성
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-yellow-50 px-4 py-3">
              <div className="text-sm font-semibold text-yellow-800">실행사</div>
              <div className="text-xl font-extrabold text-yellow-600">{s.executionCompanies}곳</div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3">
              <div className="text-sm font-semibold text-orange-800">대행사</div>
              <div className="text-xl font-extrabold text-orange-600">{s.agencies}곳</div>
            </div>
          </div>
          <div className="mt-3">
            <LinkButton href="/admin/members" size="sm" variant="outline" className="w-full">광고주 관리</LinkButton>
          </div>
        </Card>

        {/* 플랫폼별 캠페인 */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
            <IconZap size={15} className="text-brand-pink" />
            플랫폼별 캠페인
          </h3>
          <div className="space-y-3">
            {[
              { key: "youtube", label: "YouTube Shorts", color: "bg-red-50 text-red-700 border-red-100" },
              { key: "instagram", label: "Instagram Reels", color: "bg-pink-50 text-pink-700 border-pink-100" },
              { key: "tiktok", label: "TikTok", color: "bg-gray-50 text-gray-700 border-gray-200" },
            ].map(({ key, label, color }) => {
              const count = platformCount[key] ?? 0;
              const total = db.ad_campaigns.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>{label}</span>
                    <span className="font-bold text-gray-700">{count}건</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-brand-purple to-brand-pink" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 빠른 실행 */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
            <IconShield size={15} className="text-brand-purple" />
            빠른 실행
          </h3>
          <div className="space-y-2">
            {[
              { href: "/admin/videos",   label: "영상 승인 관리",  Icon: IconFilm,      badge: pendingVideos.length },
              { href: "/admin/campaigns",label: "캠페인 심사",      Icon: IconMegaphone, badge: pendingCampaigns.length },
              { href: "/admin/payouts",  label: "출금 정산 처리",  Icon: IconCreditCard,badge: pendingPayouts.length },
              { href: "/admin/members",  label: "회원 관리",        Icon: IconUsers,     badge: 0 },
              { href: "/admin/settings", label: "정책 설정",        Icon: IconClipboard, badge: 0 },
            ].map(({ href, label, Icon, badge }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <Icon size={15} className="shrink-0 text-gray-400" />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
                )}
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
