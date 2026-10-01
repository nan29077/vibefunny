import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS, displayName } from "@/lib/schema";
import { AppShell } from "@/components/layout/app-shell";
import { getDb } from "@/lib/db";
import { aiShortsMenuVisible } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "크리에이터",
  robots: { index: false, follow: false },
};

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const user = requireRole("creator");
  // AI 숏츠 메뉴는 최고관리자 스위치 상태를 매 요청마다 읽어 즉시 반영
  const aiShorts = aiShortsMenuVisible(getDb(), user);
  return (
    <AppShell nav={navForRole("creator", null, { aiShorts })} userName={displayName(user)} roleLabel={ROLE_LABELS.creator} avatarUrl={user.avatar_url} sidebarSide="left">
      {children}
    </AppShell>
  );
}
