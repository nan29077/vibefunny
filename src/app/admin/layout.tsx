import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS, displayName } from "@/lib/schema";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = requireAdmin();
  return (
    <AppShell nav={navForRole("admin")} userName={displayName(user)} roleLabel={ROLE_LABELS.admin}>
      {children}
    </AppShell>
  );
}
