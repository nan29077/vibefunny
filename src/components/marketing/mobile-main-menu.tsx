"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBarChart, IconCalendar, IconGlobe, IconHome, IconInfo,
  IconMegaphone, IconMenu, IconPieChart, IconUser, IconX,
} from "@/components/icons";

const menuItems = [
  { href: "/", label: "홈", Icon: IconHome },
  { href: "#income", label: "수익구조", Icon: IconBarChart },
  { href: "#roadmap", label: "수익 로드맵", Icon: IconCalendar },
  { href: "#simulate", label: "수익 시뮬레이션", Icon: IconPieChart },
  { href: "#platforms", label: "플랫폼", Icon: IconGlobe },
  { href: "#faq", label: "FAQ", Icon: IconInfo },
  { href: "/for-advertisers", label: "광고주", Icon: IconMegaphone },
];

export function MobileMainMenu({ myPageHref }: { myPageHref: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="vf-mobile-menu">
      <button type="button" className="vf-hamburger" onClick={() => setOpen(true)} aria-label="전체 메뉴 열기"><IconMenu size={22} /></button>
      {open && <div className="vf-mobile-menu-layer">
        <button type="button" aria-label="메뉴 닫기" className="vf-menu-backdrop" onClick={() => setOpen(false)} />
        <aside className="vf-mobile-drawer" aria-label="전체 메뉴">
          <div className="vf-drawer-top"><span className="vf-drawer-logo">VIBE<b>FUNNY</b></span><button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기"><IconX size={22} /></button></div>
          <p>MENU</p>
          <nav>{menuItems.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)}><Icon size={20} /><span>{label}</span></Link>)}<Link href={myPageHref} onClick={() => setOpen(false)}><IconUser size={20} /><span>마이페이지</span></Link></nav>
        </aside>
      </div>}
    </div>
  );
}

const publicBottomItems = [
  { key: "income", href: "/#income", label: "수익구조", Icon: IconBarChart },
  { key: "roadmap", href: "/#roadmap", label: "로드맵", Icon: IconCalendar },
  { key: "home", href: "/", label: "홈", Icon: IconHome },
  { key: "platforms", href: "/#platforms", label: "플랫폼", Icon: IconGlobe },
] as const;

export function MobilePublicNav({ myPageHref }: { myPageHref: string }) {
  const pathname = usePathname();
  const routeActive = pathname === "/" ? "home" : "mypage";
  const [active, setActive] = useState(routeActive);

  useEffect(() => setActive(routeActive), [routeActive]);

  return (
    <nav className="vf-mobile-main-nav" aria-label="바이브퍼니 주요 메뉴">
      {publicBottomItems.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          className={active === key ? "is-active" : undefined}
          aria-current={active === key ? "page" : undefined}
          onClick={() => setActive(key)}
        >
          <Icon size={key === "home" ? 21 : 18} />
          {label}
        </Link>
      ))}
      <Link
        href={myPageHref}
        className={active === "mypage" ? "is-active" : undefined}
        aria-current={active === "mypage" ? "page" : undefined}
        onClick={() => setActive("mypage")}
      >
        <IconUser size={18} />
        마이페이지
      </Link>
    </nav>
  );
}
