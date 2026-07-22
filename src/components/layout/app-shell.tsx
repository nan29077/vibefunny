"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/nav";
import { logoutAction } from "@/lib/actions/auth-actions";
import { NavIcon, IconHome, IconMenu, IconX, IconLogOut } from "@/components/icons";
import { MobilePublicNav } from "@/components/marketing/mobile-main-menu";
import { SupportWidget } from "@/components/support/support-widget";

export function AppShell({
  nav,
  userName,
  roleLabel,
  avatarUrl,
  sidebarSide = "right",
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  avatarUrl?: string | null;
  sidebarSide?: "left" | "right";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 현재 경로에 가장 길게(정확히) 매칭되는 nav 항목 하나만 활성화한다.
  // (예: /admin/products/orders 진입 시 /admin/products 가 함께 활성화되던 버그 수정)
  const activeHref = useMemo(() => {
    let best = "";
    for (const item of nav) {
      if (pathname === item.href) return item.href; // 정확 매칭 최우선
      if (pathname.startsWith(item.href + "/") && item.href.length > best.length) {
        best = item.href;
      }
    }
    return best;
  }, [nav, pathname]);

  const isActive = (href: string) => href !== "" && href === activeHref;

  const Logo = (
    <Link href="/" className="vf-site-logo vf-shell-logo">
      <span>VIBE</span><b>FUNNY</b>
    </Link>
  );

  const SidebarNav = () => {
    let lastGroup: string | undefined = undefined;

    return (
      <nav className="space-y-0.5">
        {nav.map((item) => {
          const active = isActive(item.href);
          const showGroupHeader = item.group && item.group !== lastGroup;
          if (showGroupHeader) lastGroup = item.group;

          return (
            <div key={item.href}>
              {showGroupHeader && (
                <div className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {item.group}
                </div>
              )}
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-brand-yellow text-gray-950 shadow-sm"
                    : "text-gray-600 hover:bg-amber-50"
                )}
              >
                <NavIcon
                  name={item.icon}
                  size={16}
                  className={active ? "text-gray-950" : "text-amber-500"}
                />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
    );
  };

  return (
    <div className={`vf-app-shell vf-app-shell-${sidebarSide} min-h-screen bg-[#fffdf5]`}>
      {/* 데스크탑 사이드바 */}
      <aside className={cn(
        "fixed bottom-0 top-0 z-30 hidden w-64 flex-col bg-white p-4 lg:flex",
        sidebarSide === "left" ? "left-0 border-r border-amber-200 shadow-[12px_0_30px_rgba(38,30,8,.08)]" : "right-0 border-l border-amber-200 shadow-[-12px_0_30px_rgba(38,30,8,.08)]"
      )}>
        <div className="px-2 py-2">{Logo}</div>
        <div className="mt-4 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 px-2">
            {avatarUrl ? <img src={avatarUrl} alt={`${userName} 프로필 캐릭터`} className="h-11 w-11 rounded-full border-2 border-amber-300 bg-amber-50 object-cover shadow-sm" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-100 text-xs">🐝</span>}
            <div><div className="text-sm font-semibold text-gray-800">{userName}</div><div className="text-xs text-gray-400">{roleLabel}</div></div>
          </div>
          {sidebarSide === "left" && (
            <Link href="/" className="vf-sidebar-home">
              <IconHome size={16} />
              메인으로
            </Link>
          )}
          <form action={logoutAction} className="mt-2">
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">
              <IconLogOut size={14} className="text-gray-400" />
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* 모바일 상단바 */}
      <div className={cn("flex min-h-screen flex-col", sidebarSide === "left" ? "lg:pl-64" : "lg:pr-64")}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-amber-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          {Logo}
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="메뉴 열기"
          >
            <IconMenu size={20} />
          </button>
        </header>

        {/* 모바일 드로어 */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <div className={cn(
              "absolute top-0 h-full w-72 animate-fade-in bg-white p-4 shadow-xl",
              sidebarSide === "left" ? "left-0" : "right-0"
            )}>
              <div className="flex items-center justify-between">
                {Logo}
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                  <IconX size={20} />
                </button>
              </div>
              <div className="mt-4 overflow-y-auto">
                <SidebarNav />
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-sm font-semibold text-gray-800">{userName}</div>
                <div className="text-xs text-gray-400">{roleLabel}</div>
                {sidebarSide === "left" && (
                  <Link href="/" onClick={() => setOpen(false)} className="vf-sidebar-home">
                    <IconHome size={16} />
                    메인으로
                  </Link>
                )}
                <form action={logoutAction} className="mt-2">
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">
                    <IconLogOut size={14} className="text-gray-400" />
                    로그아웃
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-7">{children}</main>

        {/* 모바일 하단탭 */}
        <MobilePublicNav myPageHref={nav[0]?.href ?? "/login"} />
        <SupportWidget isAuthenticated />
      </div>
    </div>
  );
}
