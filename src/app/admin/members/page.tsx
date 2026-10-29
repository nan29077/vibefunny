import Link from "next/link";
import { formatDate } from "@/lib/date";
import { getDb } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { ROLE_LABELS, ADVERTISER_TYPE_LABELS } from "@/lib/schema";
import { nameOf } from "@/lib/queries";
import { statusLabel, statusTone } from "@/lib/labels";
import { setMemberStatusAction, setSocialVerificationAction, setVibeMemberAction } from "@/lib/actions/admin-actions";
import { isVibeMember, GENERAL_MEMBER_LABEL, VIBE_MEMBER_LABEL } from "@/lib/membership";
import { SOCIAL_PLATFORM_LABELS, displayName } from "@/lib/schema";
import { safeHref } from "@/lib/url";
import {
  IconUsers, IconFilm, IconMegaphone,
  IconBuilding, IconShield,
} from "@/components/icons";
import { requireAdmin } from "@/lib/auth";

const toneClass: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

type Tab = "all" | "creator" | "general" | "vibe" | "advertiser" | "suspended";

const TABS: { key: Tab; label: string; icon: typeof IconUsers }[] = [
  { key: "all",        label: "전체",     icon: IconUsers       },
  { key: "creator",    label: "크리에이터", icon: IconFilm        },
  { key: "general",    label: "일반회원(결제 전)", icon: IconUsers  },
  { key: "vibe",       label: "바이브회원",  icon: IconUsers      },
  { key: "advertiser", label: "광고주",    icon: IconMegaphone   },
  { key: "suspended",  label: "정지 회원", icon: IconShield      },
];

export default function AdminMembersPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  requireAdmin();
  const db = getDb();
  const tab = (searchParams.tab ?? "all") as Tab;

  const allMembers = db.profiles
    .filter((p) => p.role !== "admin")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = allMembers.filter((m) => {
    if (tab === "all")        return true;
    if (tab === "suspended")  return m.status === "suspended";
    if (tab === "general")    return m.role === "creator" && !isVibeMember(db, m);
    if (tab === "vibe")       return m.role === "creator" && isVibeMember(db, m);
    return m.role === tab;
  });

  // 인증 요청(pending) 우선, 그다음 미인증 채널
  const channelQueue = db.social_accounts
    .filter((s) => s.verified_status !== "verified")
    .sort((a, b) => (a.verified_status === "pending" ? -1 : 1) - (b.verified_status === "pending" ? -1 : 1) || b.created_at.localeCompare(a.created_at));

  const counts = {
    all:        allMembers.length,
    creator:    allMembers.filter((m) => m.role === "creator").length,
    general:    allMembers.filter((m) => m.role === "creator" && !isVibeMember(db, m)).length,
    vibe:       allMembers.filter((m) => m.role === "creator" && isVibeMember(db, m)).length,
    advertiser: allMembers.filter((m) => m.role === "advertiser").length,
    suspended:  allMembers.filter((m) => m.status === "suspended").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="회원 관리" description="회원 조회, 상태 변경, 상세 정보 확인" />

      {/* SNS 채널 인증 대기 — 인증된 채널이 있어야 크리에이터가 캠페인에 참여할 수 있다 */}
      <div id="channels" className="scroll-mt-20" />
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">SNS 채널 인증 대기 ({channelQueue.length})</h2>
          <span className="text-xs text-gray-400">인증 완료된 채널이 있어야 해당 플랫폼 캠페인에 참여할 수 있습니다.</span>
        </div>
        {channelQueue.length === 0 ? (
          <p className="text-sm text-gray-400">인증 대기 중인 채널이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {channelQueue.map((s) => {
              const owner = db.profiles.find((p) => p.id === s.creator_id);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-gray-600">{SOCIAL_PLATFORM_LABELS[s.platform]}</span>
                  <Link href={`/admin/members/${s.creator_id}`} className="font-medium text-gray-800 hover:underline">{displayName(owner)}</Link>
                  <span className="text-gray-600">{s.account_name}</span>
                  <a href={safeHref(s.channel_url)} target="_blank" rel="noreferrer" className="text-xs text-brand-purple underline">채널 열기</a>
                  <span className="text-xs text-gray-500">팔로워 {s.follower_count.toLocaleString("ko-KR")}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(s.verified_status)]}`}>{s.verified_status === "pending" ? "인증 요청" : statusLabel(s.verified_status)}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <form action={setSocialVerificationAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="decision" value="verify" />
                      <SubmitButton size="sm">인증 승인</SubmitButton>
                    </form>
                    <form action={setSocialVerificationAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input name="memo" aria-label="반려 사유" placeholder="반려 사유" className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                      <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 탭 */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/admin/members?tab=${key}`}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "border-brand-purple bg-brand-purple text-white"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon size={14} />
            {label}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              tab === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {counts[key]}
            </span>
          </Link>
        ))}
      </div>

      {/* 회원 목록 */}
      {filtered.length === 0 ? (
        <Card><EmptyState title="해당 회원이 없습니다" /></Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                <tr>
                  <th className="px-4 py-3">회원</th>
                  <th className="px-4 py-3">역할</th>
                  <th className="px-4 py-3">추천코드</th>
                  <th className="px-4 py-3">추천인</th>
                  <th className="px-4 py-3">가입일</th>
                  <th className="px-4 py-3">회원 등급</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/members/${m.id}`} className="group flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-pink text-xs font-bold text-white">
                          {m.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-brand-purple">{m.name}</div>
                          <div className="text-xs text-gray-400">{m.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {ROLE_LABELS[m.role]}
                      {m.advertiser_type && (
                        <span className="ml-1 text-xs text-gray-400">· {ADVERTISER_TYPE_LABELS[m.advertiser_type]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.referral_code}</td>
                    <td className="px-4 py-3 text-gray-500">{nameOf(db, m.referred_by_user_id) || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3">
                      {m.role === "creator" ? (
                        isVibeMember(db, m) ? (
                          <div>
                            <span className="whitespace-nowrap rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{VIBE_MEMBER_LABEL}</span>
                            {m.vibe_member_at && <div className="mt-0.5 whitespace-nowrap text-[11px] text-gray-400">{formatDate(m.vibe_member_at)}</div>}
                          </div>
                        ) : (
                          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{GENERAL_MEMBER_LABEL} · 결제 전</span>
                        )
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(m.status)]}`}>
                        {statusLabel(m.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/members/${m.id}`}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          상세보기
                        </Link>
                        {m.status !== "active" && m.status !== "pending" && (
                          <form action={setMemberStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="active" />
                            <SubmitButton size="sm" variant="outline" confirmMessage="이 회원을 활성화할까요?">활성</SubmitButton>
                          </form>
                        )}
                        {m.role === "creator" && !isVibeMember(db, m) && m.status !== "suspended" && (
                          <form action={setVibeMemberAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="grant" value="1" />
                            <SubmitButton size="sm" variant="outline" className="whitespace-nowrap" confirmMessage="가입비를 면제하고 바이브회원으로 전환할까요? (추천 수당은 발생하지 않습니다)">바이브 전환(면제)</SubmitButton>
                          </form>
                        )}
                        {m.status !== "suspended" && (
                          <form action={setMemberStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="suspended" />
                            <SubmitButton size="sm" variant="danger" className="whitespace-nowrap" confirmMessage="이 회원의 계정을 정지할까요? 정지된 회원은 로그인할 수 없습니다.">정지</SubmitButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
