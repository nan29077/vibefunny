import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import Link from "next/link";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_COLORS,
  ALL_SOCIAL_PLATFORMS,
  displayName,
  type SocialPlatform,
  type Profile,
  type SocialAccount,
} from "@/lib/schema";
import { IconHeartHandshake } from "@/components/icons";

export const dynamic = "force-dynamic";

// ── 플랫폼별 외부 링크 아이콘 SVG ──────────────────────────────────────────
function PlatformBadge({
  platform,
  account,
}: {
  platform: SocialPlatform;
  account: SocialAccount;
}) {
  const { color, bg } = SOCIAL_PLATFORM_COLORS[platform];
  const label = SOCIAL_PLATFORM_LABELS[platform];
  const fc = account.follower_count ?? 0;
  const followerText =
    fc >= 10000
      ? (fc / 10000).toFixed(1).replace(/\.0$/, "") + "만"
      : fc.toLocaleString("ko-KR");
  return (
    <a
      href={account.channel_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 hover:shadow-md"
      style={{ color, background: bg, border: `1px solid ${color}33` }}
      title={`${label} ${followerText}명 · 구독 / 팔로우하기`}
    >
      <PlatformIcon platform={platform} size={13} />
      <span>{label}</span>
      {fc > 0 && (
        <span className="font-normal opacity-70" style={{ fontSize: "10px" }}>
          {followerText}명
        </span>
      )}
      <span className="opacity-50 transition-opacity group-hover:opacity-100">↗</span>
    </a>
  );
}

function PlatformIcon({ platform, size = 14 }: { platform: SocialPlatform; size?: number }) {
  const s = size;
  if (platform === "youtube") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 1.95C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 0 0 1.94-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
      </svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
      </svg>
    );
  }
  // facebook
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

// ── 크리에이터 카드 ─────────────────────────────────────────────────────────
function CreatorCard({
  creator,
  accounts,
  isNew,
  isMe,
}: {
  creator: Profile;
  accounts: SocialAccount[];
  isNew: boolean;
  isMe: boolean;
}) {
  const creatorDisplay = displayName(creator);
  const initials = creatorDisplay.slice(0, 2).toUpperCase();
  const joinedDate = new Date(creator.created_at).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="relative rounded-2xl border p-5 transition-all hover:shadow-lg"
      style={{
        background: isNew ? "rgba(245,158,11,0.03)" : "#fff",
        borderColor: isNew ? "rgba(245,158,11,0.4)" : "#e5e7eb",
      }}
    >
      {isNew && (
        <div className="absolute -top-2.5 left-4">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-black text-black" style={{ background: "#f59e0b" }}>
            NEW
          </span>
        </div>
      )}
      {isMe && (
        <div className="absolute -top-2.5 right-4">
          <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-bold text-white">나</span>
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
          style={{ background: `hsl(${(creatorDisplay.charCodeAt(0) * 47) % 360}, 55%, 50%)` }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{creatorDisplay}</p>
          <p className="text-xs text-gray-400">{joinedDate} 가입</p>
        </div>
      </div>

      {/* SNS 계정들 */}
      {accounts.length === 0 ? (
        <p className="text-xs text-gray-400 italic">등록된 SNS 채널 없음</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => (
            <PlatformBadge key={acc.id} platform={acc.platform} account={acc} />
          ))}
        </div>
      )}

      {/* 팔로워 합계 */}
      {accounts.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          채널 {accounts.length}개 · 총 팔로워{" "}
          <span className="font-bold text-gray-600">
            {accounts.reduce((s, a) => s + a.follower_count, 0).toLocaleString("ko-KR")}
          </span>
          명
        </p>
      )}
    </div>
  );
}

// ── 플랫폼 필터 탭 ──────────────────────────────────────────────────────────
// (서버 컴포넌트이므로 URL searchParam으로 처리)

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function CreatorCommunityPage({
  searchParams,
}: {
  searchParams?: { platform?: string; tab?: string };
}) {
  const me = requireRole("creator");
  const db = getDb();

  // 30일 이내 가입 = 신규
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 모든 크리에이터 (활성)
  const allCreators = db.profiles.filter((p) => p.role === "creator" && p.status === "active");

  // 플랫폼 필터
  const activePlatform = (searchParams?.platform ?? "") as SocialPlatform | "";
  const activeTab = searchParams?.tab ?? "all"; // "all" | "new"

  // creator별 SNS 계정 맵
  const accountMap = new Map<string, SocialAccount[]>();
  for (const acc of db.social_accounts) {
    if (!accountMap.has(acc.creator_id)) accountMap.set(acc.creator_id, []);
    accountMap.get(acc.creator_id)!.push(acc);
  }

  // 필터 적용
  let filtered = allCreators.map((c) => {
    const accounts = (accountMap.get(c.id) ?? []).filter(
      (a) => !activePlatform || a.platform === activePlatform
    );
    const isNew = new Date(c.created_at) > threshold;
    const isMe = c.id === me.id;
    return { creator: c, accounts, isNew, isMe };
  });

  if (activeTab === "new") {
    filtered = filtered.filter((x) => x.isNew);
  }

  if (activePlatform) {
    filtered = filtered.filter((x) => x.accounts.length > 0);
  }

  // 정렬: NEW 먼저, 그 다음 최근 가입 순
  filtered.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return new Date(b.creator.created_at).getTime() - new Date(a.creator.created_at).getTime();
  });

  const newCount = filtered.filter((x) => x.isNew).length;
  const total = allCreators.length;

  // 플랫폼별 등록 수 집계
  const platformCounts = ALL_SOCIAL_PLATFORMS.reduce(
    (acc, p) => {
      acc[p] = db.social_accounts.filter((s) => s.platform === p).length;
      return acc;
    },
    {} as Record<SocialPlatform, number>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="SNS 맞구독"
        description="크리에이터들의 SNS 채널을 맞구독하며 함께 성장하세요."
      />

      {/* 안내 카드 */}
      <Card className="border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <IconHeartHandshake size={22} className="shrink-0 text-amber-600" strokeWidth={1.75} />
          <div>
            <p className="font-bold text-amber-900">서로 구독하고 팔로우하세요</p>
            <p className="mt-0.5 text-sm text-amber-700">
              아래 버튼(채널명)을 클릭하면 해당 SNS 채널로 이동합니다. 구독·팔로우는 각 플랫폼에서 직접 진행하세요.
              내 채널이 보이려면 먼저{" "}
              <Link href="/creator/social" className="font-bold underline">
                SNS 계정 관리
              </Link>
              에서 채널을 등록하세요.
            </p>
          </div>
        </div>
      </Card>

      {/* 플랫폼 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <TabLink href="?tab=all" active={activeTab === "all" && !activePlatform}>
          전체 ({total}명)
        </TabLink>
        <TabLink href="?tab=new" active={activeTab === "new"}>
          🆕 신규 가입 ({newCount}명)
        </TabLink>
        <span className="text-gray-300">|</span>
        {ALL_SOCIAL_PLATFORMS.map((p) => {
          const { color, bg } = SOCIAL_PLATFORM_COLORS[p];
          const isActive = activePlatform === p;
          return (
            <a
              key={p}
              href={`?platform=${p}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all hover:scale-105"
              style={{
                color: isActive ? "#fff" : color,
                background: isActive ? color : bg,
                border: `1px solid ${color}44`,
              }}
            >
              <PlatformIcon platform={p} size={12} />
              {SOCIAL_PLATFORM_LABELS[p]} ({platformCounts[p]})
            </a>
          );
        })}
      </div>

      {/* 신규 가입자 하이라이트 배너 (all 탭일 때만) */}
      {activeTab === "all" && !activePlatform && newCount > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-black text-black"
              style={{ background: "#f59e0b" }}
            >
              NEW
            </span>
            <h2 className="text-sm font-bold text-gray-700">
              신규 가입 크리에이터 — 먼저 구독해 주세요!
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered
              .filter((x) => x.isNew)
              .map(({ creator, accounts, isMe }) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  accounts={accounts}
                  isNew
                  isMe={isMe}
                />
              ))}
          </div>
        </section>
      )}

      {/* 전체 목록 */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-gray-500">
          {activeTab === "new"
            ? `신규 크리에이터 ${filtered.length}명`
            : activePlatform
              ? `${SOCIAL_PLATFORM_LABELS[activePlatform as SocialPlatform]} 채널 보유 크리에이터 ${filtered.length}명`
              : `전체 크리에이터 ${filtered.length}명`}
        </h2>
        {filtered.length === 0 ? (
          <EmptyState title="조건에 맞는 크리에이터가 없습니다" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ creator, accounts, isNew, isMe }) => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                accounts={accounts}
                isNew={isNew}
                isMe={isMe}
              />
            ))}
          </div>
        )}
      </section>

      {/* 내 채널 등록 CTA */}
      <Card className="border-gray-200 bg-gray-50 text-center">
        <p className="font-bold text-gray-700">내 채널을 등록하면 다른 크리에이터가 구독할 수 있어요!</p>
        <Link
          href="/creator/social"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-black text-black transition hover:opacity-80"
          style={{ background: "#f59e0b" }}
        >
          내 SNS 계정 관리 →
        </Link>
      </Card>
    </div>
  );
}

// ── 탭 링크 헬퍼 ────────────────────────────────────────────────────────────
function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
        active
          ? "bg-yellow-400 text-black"
          : "text-gray-600 hover:text-black hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}
