import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SiteHowto } from "@/components/site/site-content";
import { PageHeader, StatCard, Card, LinkButton } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { statusLabel, statusTone, CREATOR_WALLET_TX_TYPE_LABELS } from "@/lib/labels";
import { displayName } from "@/lib/schema";
import { isVibeMember, GENERAL_MEMBER_LABEL, VIBE_MEMBER_LABEL } from "@/lib/membership";
import { ReferralCard } from "@/components/referral-card";
import { aiShortsAccess, aiShortsUsable } from "@/lib/ai/settings";
import { formatFunny, funnyBalance } from "@/lib/funny";
import {
  IconMegaphone, IconDollarSign, IconTrendingUp,
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

  // 스위치가 켜져 있어도 대본 AI 모델이 준비되지 않았으면 대시보드 카드를 숨긴다
  const aiShortsOpen = aiShortsAccess(db, user).open && aiShortsUsable(db) && isVibeMember(db, user);
  const funny = funnyBalance(db, user.id);
  const w = db.wallets.find((x) => x.user_id === user.id) ?? {
    pending_balance: 0, available_balance: 0, paid_balance: 0,
  };

  const myApplications = db.campaign_applications.filter((a) => a.creator_id === user.id);
  const mySocials     = db.social_accounts.filter((s) => s.creator_id === user.id);
  const myPayouts     = db.payout_requests.filter((r) => r.user_id === user.id);

  // 최근 수익 거래 5건
  const recentTx = [...db.wallet_transactions]
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // 캠페인 상태 분류
  const campaignStats = {
    applied:  myApplications.filter((a) => a.status === "applied").length,
    approved: myApplications.filter((a) => a.status === "approved").length,
  };

  // 배포 완료 건수 & 수익
  const deliveries = db.campaign_deliveries.filter((d) => d.creator_id === user.id);
  const deliveryEarnings = deliveries.reduce((sum, d) => sum + d.reward_amount, 0);

  // 추천인 제도
  const referredCount   = db.referral_relations.filter(
    (r) => r.referrer_id === user.id && r.referral_type === "signup"
  ).length;
  const referralEarnings = db.wallet_transactions
    .filter((t) => t.user_id === user.id && t.type === "signup_referral")
    .reduce((sum, t) => sum + t.amount, 0);

  // 회원 등급: 가입비 결제 전 일반회원 / 결제 후 바이브회원
  const vibe = isVibeMember(db, user);
  const signupFee = db.settings.fees.creator.signup_fee_amount;

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

      {vibe ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
          <IconCheckCircle size={13} /> {VIBE_MEMBER_LABEL}
        </div>
      ) : (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-amber-900">지금은 {GENERAL_MEMBER_LABEL}입니다</div>
              <div className="text-sm text-amber-800">
                가입비({formatKRW(signupFee)})를 결제하면 {VIBE_MEMBER_LABEL}으로 전환되어 캠페인 참여·영상 제작 의뢰·쇼츠 커머스·AI 숏츠·출금·SNS 맞구독을 이용하고, 내 추천 코드로 멘티를 받을 수 있습니다.
              </div>
            </div>
            <LinkButton href="/payment/activate">가입비 결제하고 {VIBE_MEMBER_LABEL} 되기</LinkButton>
          </div>
        </Card>
      )}

      {/* AI 숏츠 (최고관리자가 켰을 때만) */}
      {aiShortsOpen && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-gray-900">AI 숏츠 만들기</div>
              <div className="text-sm text-gray-600">주제만 입력하면 대본·이미지·내레이션·자막까지 AI가 만들어 줍니다. 보유 퍼니 <b className="text-brand-purple">{formatFunny(funny.available)}</b></div>
            </div>
            <div className="flex gap-2">
              <LinkButton href="/creator/funny" variant="outline" size="sm">퍼니 충전</LinkButton>
              <LinkButton href="/creator/ai-shorts" size="sm">숏츠 만들기</LinkButton>
            </div>
          </div>
        </Card>
      )}

      {/* 수익 현황 4카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="지급 대기 수익" value={formatKRW(w.pending_balance)} accent="yellow" />
        <StatCard label="지급 가능 수익" value={formatKRW(w.available_balance)} accent="purple" />
        <StatCard label="지급 완료" value={formatKRW(w.paid_balance)} accent="gray" />
        <StatCard label="참여 캠페인" value={`${myApplications.length}건`} accent="pink" />
      </div>

      {/* 캠페인 현황 */}
      <div>
        {/* 캠페인 & 배포 */}
        <Card>
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
                      {CREATOR_WALLET_TX_TYPE_LABELS[t.type] ?? t.type}
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
                  facebook: "bg-blue-50 text-blue-700 border-blue-200",
                };
                const platformLabels: Record<string, string> = {
                  youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook",
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

      {/* 추천인 카드: 멘티를 받을 수 있는 바이브회원에게만 (추천 코드는 크리에이터 가입에 항상 필요) */}
      {vibe && (
        <ReferralCard
          referralCode={user.referral_code}
          referredCount={referredCount}
          referralEarnings={referralEarnings}
        />
      )}
      <SiteHowto blocks={db.settings.site_howto_blocks} role="creator" />
    </div>
  );
}
