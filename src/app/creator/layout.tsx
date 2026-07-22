import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS, displayName } from "@/lib/schema";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "크리에이터",
  robots: { index: false, follow: false },
};

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const user = requireRole("creator");
  return (
    <AppShell nav={navForRole("creator")} userName={displayName(user)} roleLabel={ROLE_LABELS.creator}>
      {children}
    </AppShell>
  );
}
