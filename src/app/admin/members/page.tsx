import Link from "next/link";
import { formatDate } from "@/lib/date";
import { getDb } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { ROLE_LABELS, ADVERTISER_TYPE_LABELS } from "@/lib/schema";
import { nameOf } from "@/lib/queries";
import { statusLabel, statusTone } from "@/lib/labels";
import { setMemberStatusAction } from "@/lib/actions/admin-actions";
import {
  IconUsers, IconFilm, IconMegaphone,
  IconBuilding, IconShield,
} from "@/components/icons";

const toneClass: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

type Tab = "all" | "creator" | "advertiser" | "suspended";

const TABS: { key: Tab; label: string; icon: typeof IconUsers }[] = [
  { key: "all",        label: "전체",     icon: IconUsers       },
  { key: "creator",    label: "크리에이터", icon: IconFilm        },
  { key: "advertiser", label: "광고주",    icon: IconMegaphone   },
  { key: "suspended",  label: "정지 회원", icon: IconShield      },
];

export default function AdminMembersPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const db = getDb();
  const tab = (searchParams.tab ?? "all") as Tab;

  const allMembers = db.profiles
    .filter((p) => p.role !== "admin")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = allMembers.filter((m) => {
    if (tab === "all")        return true;
    if (tab === "suspended")  return m.status === "suspended";
    return m.role === tab;
  });

  const counts = {
    all:        allMembers.length,
    creator:    allMembers.filter((m) => m.role === "creator").length,
    advertiser: allMembers.filter((m) => m.role === "advertiser").length,
    suspended:  allMembers.filter((m) => m.status === "suspended").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="회원 관리" description="회원 조회, 상태 변경, 상세 정보 확인" />

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
                    <td className="px-4 py-3 text-gray-600">
                      {ROLE_LABELS[m.role]}
                      {m.advertiser_type && (
                        <span className="ml-1 text-xs text-gray-400">· {ADVERTISER_TYPE_LABELS[m.advertiser_type]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.referral_code}</td>
                    <td className="px-4 py-3 text-gray-500">{nameOf(db, m.referred_by_user_id) || "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(m.status)]}`}>
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
                        {m.status !== "active" && (
                          <form action={setMemberStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="active" />
                            <SubmitButton size="sm" variant="outline">활성</SubmitButton>
                          </form>
                        )}
                        {m.status !== "suspended" && (
                          <form action={setMemberStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value="suspended" />
                            <SubmitButton size="sm" variant="danger">정지</SubmitButton>
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
