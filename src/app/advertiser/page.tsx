import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, StatCard, Card, LinkButton } from "@/components/ui";
import { formatKRW, formatPoint } from "@/lib/money";
import { ADVERTISER_TYPE_LABELS } from "@/lib/schema";
import { statusLabel, statusTone, CAMPAIGN_TYPE_LABELS, POINT_TX_TYPE_LABELS } from "@/lib/labels";
import {
  IconMegaphone, IconBarChart, IconDollarSign, IconZap,
  IconCheckCircle, IconBuilding, IconTrendingUp, IconUsers,
  IconGlobe, IconCreditCard,
} from "@/components/icons";

const toneClass: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function AdvertiserDashboard() {
  const user = requireRole("advertiser");
  const db = getDb();

  const pw       = db.point_wallets.find((p) => p.advertiser_id === user.id);
  const balance  = pw?.point_balance ?? 0;
  const campaigns = db.ad_campaigns.filter((c) => c.advertiser_id === user.id);

  // 캠페인 상태별
  const campStats = {
    active:    campaigns.filter((c) => ["recruiting","in_progress","submitted","published"].includes(c.status)).length,
    completed: campaigns.filter((c) => c.status === "completed").length,
    review:    campaigns.filter((c) => c.status === "admin_review").length,
    draft:     campaigns.filter((c) => ["draft","point_pending"].includes(c.status)).length,
  };

  // 최근 포인트 거래 5건
  const recentPt = [...db.point_transactions]
    .filter((t) => t.advertiser_id === user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 최근 캠페인 5건
  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 총 집행액
  const totalSpend = db.point_transactions
    .filter((t) => t.advertiser_id === user.id && t.type === "spend")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalCharged = db.point_transactions
    .filter((t) => t.advertiser_id === user.id && t.type === "charge")
    .reduce((sum, t) => sum + t.amount, 0);

  // 플랫폼별 캠페인 수
  const platformCount: Record<string, number> = {};
  campaigns.forEach((c) => c.platforms.forEach((p) => { platformCount[p] = (platformCount[p] ?? 0) + 1; }));

  // 대행사인 경우: 상위 실행사 이름
  const parentCompany = user.parent_advertiser_id
    ? db.profiles.find((p) => p.id === user.parent_advertiser_id)
    : null;

  // 실행사인 경우: 하위 대행사 목록
  const subAgencies = user.advertiser_type === "execution_company"
    ? db.profiles.filter((p) => p.parent_advertiser_id === user.id)
    : [];

  const now = new Date();
  function daysAgo(iso: string) {
    const diff = now.getTime() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "오늘";
    if (days === 1) return "어제";
    return `${days}일 전`;
  }

  const isAgency = user.advertiser_type === "agency";
  const typeLabel = user.advertiser_type ? ADVERTISER_TYPE_LABELS[user.advertiser_type] : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.name}`}
        description={`${typeLabel} 대시보드 · 총 집행액 ${formatKRW(totalSpend)}`}
      />

      {/* 대행사 상위 실행사 안내 */}
      {isAgency && parentCompany && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <IconBuilding size={16} className="shrink-0 text-orange-500" />
          <div className="text-sm text-orange-800">
            상위 실행사: <span className="font-bold">{parentCompany.name}</span>
            <span className="ml-2 text-orange-500">· 연동된 계층 광고주 계정입니다.</span>
          </div>
        </div>
      )}

      {/* 주요 지표 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="포인트 잔액" value={formatPoint(balance)} accent="purple" />
        <StatCard label="전체 캠페인" value={`${campaigns.length}건`} accent="pink" />
        <StatCard label="진행중 캠페인" value={`${campStats.active}건`} accent="yellow" />
        <StatCard label="총 집행액" value={formatKRW(totalSpend)} accent="gray" />
      </div>

      {/* 캠페인 상태 요약 + 포인트 요약 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconMegaphone size={15} className="text-brand-pink" />
              캠페인 현황
            </h3>
            <LinkButton href="/advertiser/campaigns" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "진행중",    count: campStats.active,    bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
              { label: "완료",      count: campStats.completed, bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
              { label: "심사중",    count: campStats.review,    bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
              { label: "임시저장",  count: campStats.draft,     bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200" },
            ].map(({ label, count, bg, text, border }) => (
              <div key={label} className={`rounded-xl border ${border} ${bg} p-3 text-center`}>
                <div className={`text-2xl font-extrabold ${text}`}>{count}</div>
                <div className={`mt-0.5 text-xs font-semibold ${text}`}>{label}</div>
              </div>
            ))}
          </div>
          <LinkButton href="/advertiser/campaigns/new" size="sm" className="mt-4 w-full">+ 새 캠페인 만들기</LinkButton>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconCreditCard size={15} className="text-brand-purple" />
              포인트 현황
            </h3>
            <LinkButton href="/advertiser/points" size="sm" variant="ghost">충전/내역</LinkButton>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-3">
              <span className="text-sm text-purple-700">현재 잔액</span>
              <span className="text-lg font-extrabold text-purple-700">{formatPoint(balance)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
              <span className="text-sm text-gray-600">총 충전액</span>
              <span className="font-bold text-gray-700">{formatKRW(totalCharged)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
              <span className="text-sm text-gray-600">총 집행액</span>
              <span className="font-bold text-gray-700">{formatKRW(totalSpend)}</span>
            </div>
          </div>
          <LinkButton href="/advertiser/points" size="sm" variant="outline" className="mt-4 w-full">포인트 충전하기</LinkButton>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 최근 캠페인 목록 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconBarChart size={15} className="text-brand-purple" />
              최근 캠페인
            </h3>
            <LinkButton href="/advertiser/campaigns" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          {recentCampaigns.length > 0 ? (
            <div className="space-y-3">
              {recentCampaigns.map((c) => {
                const platformIcons: Record<string, string> = {
                  youtube: "YT", instagram: "IG", tiktok: "TK", facebook: "FB",
                };
                return (
                  <div key={c.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
                      <IconMegaphone size={14} className="text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{c.title}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-gray-400">{CAMPAIGN_TYPE_LABELS[c.campaign_type]}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <div className="flex gap-1">
                          {c.platforms.map((p) => (
                            <span key={p} className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                              {platformIcons[p] ?? p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(c.status)]}`}>
                        {statusLabel(c.status)}
                      </span>
                      <span className="text-xs text-gray-400">{formatKRW(c.total_cost)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400 mb-3">등록된 캠페인이 없습니다.</p>
              <LinkButton href="/advertiser/campaigns/new" size="sm">첫 캠페인 만들기</LinkButton>
            </div>
          )}
        </Card>

        {/* 최근 포인트 거래 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconDollarSign size={15} className="text-green-600" />
              포인트 거래 내역
            </h3>
            <LinkButton href="/advertiser/points" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          {recentPt.length > 0 ? (
            <div className="space-y-2.5">
              {recentPt.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    t.amount > 0 ? "bg-green-50" : "bg-orange-50"
                  }`}>
                    {t.amount > 0
                      ? <IconZap size={13} className="text-green-500" />
                      : <IconMegaphone size={13} className="text-orange-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-gray-700">
                      {POINT_TX_TYPE_LABELS[t.type] ?? t.type}
                      {t.memo && <span className="ml-1 text-gray-400">· {t.memo}</span>}
                    </div>
                    <div className="text-xs text-gray-400">{daysAgo(t.created_at)}</div>
                  </div>
                  <span className={`text-sm font-bold ${t.amount > 0 ? "text-green-600" : "text-orange-600"}`}>
                    {t.amount > 0 ? "+" : ""}{formatPoint(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">포인트 거래 내역이 없습니다.</p>
          )}
        </Card>
      </div>

      {/* 플랫폼별 캠페인 분포 */}
      {campaigns.length > 0 && (
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
            <IconGlobe size={15} className="text-brand-purple" />
            플랫폼별 캠페인 분포
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "youtube",   label: "YouTube Shorts",  color: "from-red-400 to-red-500",     bg: "bg-red-50",   text: "text-red-600" },
              { key: "instagram", label: "Instagram Reels", color: "from-pink-400 to-purple-500", bg: "bg-pink-50",  text: "text-pink-600" },
              { key: "tiktok",    label: "TikTok",          color: "from-gray-600 to-gray-800",   bg: "bg-gray-50",  text: "text-gray-700" },
            ].map(({ key, label, bg, text }) => {
              const count = platformCount[key] ?? 0;
              const total = Object.values(platformCount).reduce((s, v) => s + v, 0) || 1;
              const pct   = Math.round((count / total) * 100);
              return (
                <div key={key} className={`rounded-xl ${bg} p-4 text-center`}>
                  <div className={`text-2xl font-extrabold ${text}`}>{count}</div>
                  <div className={`text-xs font-semibold ${text}`}>{label}</div>
                  <div className="mt-2 text-xs text-gray-400">{pct}%</div>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-gray-200">
                    <div className="h-1 rounded-full bg-gradient-to-r from-brand-purple to-brand-pink" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 실행사인 경우: 하위 대행사 */}
      {subAgencies.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <IconUsers size={15} className="text-brand-purple" />
              연결된 대행사 ({subAgencies.length}곳)
            </h3>
            <LinkButton href="/advertiser/agencies" size="sm" variant="ghost">전체 보기</LinkButton>
          </div>
          <div className="space-y-2.5">
            {subAgencies.slice(0, 4).map((a) => {
              const agCampaigns = db.ad_campaigns.filter((c) => c.advertiser_id === a.id);
              const agPw = db.point_wallets.find((p) => p.advertiser_id === a.id);
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-600">
                    {a.name.slice(0, 1)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-400">캠페인 {agCampaigns.length}건</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-700">{formatPoint(agPw?.point_balance ?? 0)}</div>
                    <div className="text-xs text-gray-400">포인트 잔액</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
