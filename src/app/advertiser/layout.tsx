import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS, displayName } from "@/lib/schema";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "광고주",
  robots: { index: false, follow: false },
};

export default function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  const user = requireRole("advertiser");
  return (
    <AppShell nav={navForRole("advertiser", user.advertiser_type)} userName={displayName(user)} roleLabel={ROLE_LABELS.advertiser} avatarUrl={user.avatar_url}>
      {children}
    </AppShell>
  );
}
