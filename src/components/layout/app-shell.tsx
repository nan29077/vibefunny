"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/nav";
import { logoutAction } from "@/lib/actions/auth-actions";
import { NavIcon, IconMenu, IconX, IconLogOut } from "@/components/icons";

export function AppShell({
  nav,
  userName,
  roleLabel,
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
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

  const bottomItems = nav.slice(0, 5);

  const Logo = (
    <Link href="/" className="flex items-center gap-1 text-xl font-black tracking-tight">
      <span className="text-gray-900">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
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
                    ? "bg-gradient-to-r from-brand-purple/10 to-brand-pink/10 text-brand-purple"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <NavIcon
                  name={item.icon}
                  size={16}
                  className={active ? "text-brand-purple" : "text-gray-400"}
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
    <div className="min-h-screen lg:flex">
      {/* 데스크탑 사이드바 */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
        <div className="px-2 py-2">{Logo}</div>
        <div className="mt-4 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="px-2 text-sm font-semibold text-gray-800">{userName}</div>
          <div className="px-2 text-xs text-gray-400">{roleLabel}</div>
          <form action={logoutAction} className="mt-2">
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">
              <IconLogOut size={14} className="text-gray-400" />
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* 모바일 상단바 */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
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
            <div className="absolute right-0 top-0 h-full w-72 animate-fade-in bg-white p-4 shadow-xl">
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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>

        {/* 모바일 하단탭 */}
        <nav className="sticky bottom-0 z-20 flex border-t border-gray-200 bg-white lg:hidden">
          {bottomItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition",
                  active ? "text-brand-purple" : "text-gray-400"
                )}
              >
                <NavIcon
                  name={item.icon}
                  size={20}
                  className={active ? "text-brand-purple" : "text-gray-400"}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
