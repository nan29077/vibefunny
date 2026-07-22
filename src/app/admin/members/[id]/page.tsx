import { notFound } from "next/navigation";
import { formatDate } from "@/lib/date";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { ROLE_LABELS, ADVERTISER_TYPE_LABELS, PLATFORM_LABELS, SOCIAL_PLATFORM_LABELS } from "@/lib/schema";
import { formatKRW, formatPoint } from "@/lib/money";
import { statusLabel, statusTone, WALLET_TX_TYPE_LABELS, POINT_TX_TYPE_LABELS, CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import { setMemberStatusAction } from "@/lib/actions/admin-actions";
import {
  IconUsers, IconFilm, IconMegaphone, IconDollarSign,
  IconCreditCard, IconGlobe, IconShoppingBag, IconBuilding,
  IconCalendar, IconMail, IconShield,
} from "@/components/icons";

const tone: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function MemberDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const db = getDb();
  const member = db.profiles.find((p) => p.id === params.id && p.role !== "admin");
  if (!member) notFound();

  const wallet     = db.wallets.find((w) => w.user_id === member.id);
  const pointWallet = db.point_wallets.find((pw) => pw.advertiser_id === member.id);
  const recentTx   = [...db.wallet_transactions]
    .filter((t) => t.user_id === member.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
  const recentPt   = [...db.point_transactions]
    .filter((t) => t.advertiser_id === member.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
  const videos     = db.videos.filter((v) => v.creator_id === member.id);
  const socials    = db.social_accounts.filter((s) => s.creator_id === member.id);
  const payouts    = db.payout_requests.filter((r) => r.user_id === member.id);
  const campaigns  = db.ad_campaigns.filter((c) => c.advertiser_id === member.id);
  const purchases  = db.video_purchases.filter((p) => p.buyer_id === member.id);
  const referrer   = member.referred_by_user_id
    ? db.profiles.find((p) => p.id === member.referred_by_user_id)
    : null;
  const referrals  = db.referral_relations.filter((r) => r.referrer_id === member.id && r.referral_type === "signup");

  const now = new Date();
  function ago(iso: string) {
    const diff = now.getTime() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    return d === 0 ? "오늘" : d === 1 ? "어제" : `${d}일 전`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/members" className="text-sm text-gray-400 hover:text-gray-700">← 회원 목록</Link>
      </div>
      <PageHeader
        title={`${member.name}`}
        description={`${ROLE_LABELS[member.role]}${member.advertiser_type ? ` · ${ADVERTISER_TYPE_LABELS[member.advertiser_type]}` : ""} · 가입일 ${formatDate(member.created_at)}`}
      />

      {/* 프로필 카드 */}
      <Card>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink text-2xl font-extrabold text-white">
            {member.name.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold text-gray-900">{member.name}</h2>
              <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${tone[statusTone(member.status)]}`}>
                {statusLabel(member.status)}
              </span>
              <span className="rounded-full bg-purple-50 px-3 py-0.5 text-sm font-semibold text-purple-700">
                {ROLE_LABELS[member.role]}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><IconMail size={13} />{member.email}</span>
              {member.phone && <span>{member.phone}</span>}
              <span className="flex items-center gap-1.5"><IconCalendar size={13} />가입 {formatDate(member.created_at)}</span>
              {referrer && (
                <span className="flex items-center gap-1.5">
                  <IconUsers size={13} />
                  추천인: <Link href={`/admin/members/${referrer.id}`} className="text-brand-purple hover:underline">{referrer.name}</Link>
                </span>
              )}
              {referrals.length > 0 && (
                <span className="flex items-center gap-1.5"><IconUsers size={13} />추천한 회원: {referrals.length}명</span>
              )}
            </div>
            <div className="mt-2">
              <span className="rounded-lg bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                추천코드 {member.referral_code}
              </span>
            </div>
          </div>
          {/* 상태 변경 */}
          <div className="flex gap-2">
            {member.status !== "active" && (
              <form action={setMemberStatusAction}>
                <input type="hidden" name="id" value={member.id} />
                <input type="hidden" name="status" value="active" />
                <SubmitButton size="sm" variant="outline">계정 활성화</SubmitButton>
              </form>
            )}
            {member.status !== "suspended" && (
              <form action={setMemberStatusAction}>
                <input type="hidden" name="id" value={member.id} />
                <input type="hidden" name="status" value="suspended" />
                <SubmitButton size="sm" variant="danger">계정 정지</SubmitButton>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* 크리에이터 전용 */}
      {member.role === "creator" && wallet && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="지급 대기 수익" value={formatKRW(wallet.pending_balance)} accent="yellow" />
            <StatCard label="지급 가능 수익" value={formatKRW(wallet.available_balance)} accent="purple" />
            <StatCard label="지급 완료" value={formatKRW(wallet.paid_balance)} accent="gray" />
          </div>

          {/* 영상 */}
          <Card>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <IconFilm size={15} className="text-brand-purple" />
              등록 영상 ({videos.length}개)
            </h3>
            {videos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-gray-400 border-b">
                    <tr><th className="pb-2">제목</th><th className="pb-2">플랫폼</th><th className="pb-2">가격</th><th className="pb-2">상태</th><th className="pb-2">등록일</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {videos.map((v) => (
                      <tr key={v.id}>
                        <td className="py-2 font-medium text-gray-800 max-w-[200px] truncate">{v.title}</td>
                        <td className="py-2 text-gray-500">{PLATFORM_LABELS[v.platform]}</td>
                        <td className="py-2 font-semibold text-brand-purple">{formatKRW(v.price)}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[statusTone(v.status)]}`}>
                            {statusLabel(v.status)}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-gray-400">{formatDate(v.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400">등록된 영상이 없습니다.</p>}
          </Card>

          {/* SNS */}
          {socials.length > 0 && (
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                <IconGlobe size={15} className="text-blue-500" />
                연동 SNS 채널 ({socials.length}개)
              </h3>
              <div className="space-y-2">
                {socials.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{SOCIAL_PLATFORM_LABELS[s.platform]}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{s.account_name}</span>
                    <span className="text-sm text-gray-500">팔로워 {s.follower_count.toLocaleString("ko-KR")}명</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[statusTone(s.verified_status)]}`}>
                      {statusLabel(s.verified_status)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 수익 내역 */}
          {recentTx.length > 0 && (
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                <IconDollarSign size={15} className="text-green-500" />
                최근 수익 내역
              </h3>
              <div className="space-y-2.5">
                {recentTx.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{WALLET_TX_TYPE_LABELS[t.type] ?? t.type}</div>
                      <div className="text-xs text-gray-400">{ago(t.created_at)}</div>
                    </div>
                    <span className={`text-sm font-bold ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {t.amount >= 0 ? "+" : ""}{formatKRW(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 출금 */}
          {payouts.length > 0 && (
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                <IconCreditCard size={15} className="text-brand-purple" />
                출금 신청 내역 ({payouts.length}건)
              </h3>
              <div className="space-y-2.5">
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{p.bank_name} {p.bank_account_number}</div>
                      <div className="text-xs text-gray-400">{formatDate(p.requested_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">{formatKRW(p.amount)}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[statusTone(p.status)]}`}>
                        {statusLabel(p.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* 광고주 전용 */}
      {member.role === "advertiser" && pointWallet && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="포인트 잔액" value={formatPoint(pointWallet.point_balance)} accent="purple" />
            <StatCard label="전체 캠페인" value={`${campaigns.length}건`} accent="pink" />
          </div>

          {campaigns.length > 0 && (
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                <IconMegaphone size={15} className="text-brand-pink" />
                캠페인 내역 ({campaigns.length}건)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-gray-400 border-b">
                    <tr><th className="pb-2">제목</th><th className="pb-2">유형</th><th className="pb-2">금액</th><th className="pb-2">상태</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {campaigns.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 font-medium text-gray-800 max-w-[200px] truncate">{c.title}</td>
                        <td className="py-2 text-gray-500">{CAMPAIGN_TYPE_LABELS[c.campaign_type]}</td>
                        <td className="py-2 font-semibold text-brand-purple">{formatKRW(c.total_cost)}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[statusTone(c.status)]}`}>
                            {statusLabel(c.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {recentPt.length > 0 && (
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                <IconCreditCard size={15} className="text-brand-purple" />
                포인트 거래 내역
              </h3>
              <div className="space-y-2.5">
                {recentPt.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{POINT_TX_TYPE_LABELS[t.type] ?? t.type}{t.memo ? ` · ${t.memo}` : ""}</div>
                      <div className="text-xs text-gray-400">{ago(t.created_at)}</div>
                    </div>
                    <span className={`text-sm font-bold ${t.amount > 0 ? "text-green-600" : "text-orange-600"}`}>
                      {t.amount > 0 ? "+" : ""}{formatPoint(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {member.advertiser_type === "execution_company" && (
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                <IconBuilding size={15} className="text-brand-purple" />
                하위 대행사
              </h3>
              {db.profiles.filter((p) => p.parent_advertiser_id === member.id).map((a) => (
                <Link key={a.id} href={`/admin/members/${a.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50">
                  <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">{a.name.slice(0,1)}</div>
                  <div className="flex-1 text-sm font-medium text-gray-800">{a.name}</div>
                  <span className="text-xs text-brand-purple hover:underline">상세보기 →</span>
                </Link>
              ))}
            </Card>
          )}
        </>
      )}

    </div>
  );
}
