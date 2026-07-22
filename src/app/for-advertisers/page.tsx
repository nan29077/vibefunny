import type { Metadata } from "next";
import Link from "next/link";
import {
  IconMegaphone, IconBuilding, IconBarChart, IconUsers, IconGlobe,
  IconZap, IconShield, IconGem, IconCheckCircle, IconDollarSign,
  IconTrendingUp, IconFilm, IconStar, IconPlay,
  IconHome, IconLogIn,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "광고주 센터",
  description:
    "VIBEFUNNY 광고주 센터 - 숏폼 배포 광고, AI 영상 제작 의뢰, 캠페인으로 브랜드를 알리세요.",
  alternates: { canonical: "/for-advertisers" },
  openGraph: {
    title: "광고주 센터 · VIBEFUNNY",
    description:
      "숏폼 배포 광고, AI 영상 제작 의뢰, 캠페인으로 브랜드를 알리세요.",
    url: "/for-advertisers",
  },
};

// ─── Unsplash backgrounds ──────────────────────────────────────────────────
const BG = {
  hero:         "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=85&fit=crop&auto=format",
  why:          "https://images.unsplash.com/photo-1551135049-8a33b5883817?w=1920&q=85&fit=crop&auto=format",
  benefits:     "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85&fit=crop&auto=format",
  process:      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1920&q=85&fit=crop&auto=format",
  testimonials: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=85&fit=crop&auto=format",
  cta:          "https://images.unsplash.com/photo-1431440015161-0bf868a2d407?w=1920&q=85&fit=crop&auto=format",
};

// ─── Data ──────────────────────────────────────────────────────────────────
const EXEC_ITEMS = [
  "직접 가입 가능 (추천 코드 불필요)",
  "자사 브랜드 캠페인 직접 등록",
  "4대 플랫폼 동시 또는 단일 집행 (YouTube·Instagram·TikTok·Facebook)",
  "포인트 선불 충전 → 투명한 예산 관리",
  "영상 제작 대행 또는 직접 업로드 선택",
  "대행사 모집 시 자동 수수료 수익 발생",
];

const AGENCY_ITEMS = [
  "실행사 추천 코드 입력 후 가입 (필수)",
  "복수 클라이언트 캠페인 일괄 관리",
  "대행 수수료 실행사에 자동 정산",
  "통합 리포트로 클라이언트 결과 제공",
  "대행사 전용 통합 대시보드 제공",
  "클라이언트별 예산·성과 분리 관리",
];

const BENEFITS = [
  { Icon: IconBarChart,    title: "실시간 투명 리포트",        desc: "배포 건수·크리에이터별 현황·플랫폼별 도달률을 대시보드에서 실시간으로 확인합니다." },
  { Icon: IconUsers,       title: "크리에이터 자동 매칭",      desc: "캠페인 카테고리·플랫폼에 맞는 검증된 크리에이터를 시스템이 자동으로 매칭합니다." },
  { Icon: IconGlobe,       title: "4대 플랫폼 동시 집행",      desc: "YouTube Shorts·Instagram Reels·TikTok·Facebook Reels를 하나의 캠페인으로 동시에 운영하세요." },
  { Icon: IconZap,         title: "빠른 심사 & 즉시 집행",     desc: "캠페인 등록 후 관리자 심사가 완료되면 즉시 크리에이터 모집이 시작됩니다." },
  { Icon: IconShield,      title: "포인트 기반 안전 결제",      desc: "선불 포인트 충전 방식으로 과금 리스크 없이 예산을 완전히 통제하세요." },
  { Icon: IconGem,         title: "대행사 계층 자동 관리",      desc: "실행사가 대행사를 초대하면 수수료 정산·리포트 열람이 자동으로 연결됩니다." },
  { Icon: IconDollarSign,  title: "성과 기반 비용 구조",        desc: "배포 완료 건수 기준으로 포인트가 차감되어 낭비 없는 예산 집행이 가능합니다." },
  { Icon: IconTrendingUp,  title: "숏폼 특화 크리에이터",       desc: "숏폼 전문 크리에이터만 모집해 콘텐츠 퀄리티와 업로드 일정을 보장합니다." },
  { Icon: IconFilm,        title: "영상 제작 대행 가능",        desc: "촬영 소스가 없어도 됩니다. VIBEFUNNY 크리에이터가 AI로 영상을 제작합니다." },
];

const PROCESS = [
  { n: "01", title: "계정 생성",           desc: "실행사 또는 대행사 유형 선택 후 가입. 대행사는 실행사 추천 코드를 입력하세요." },
  { n: "02", title: "포인트 충전",          desc: "캠페인 예산만큼 포인트를 충전합니다. 최소 ₩150,000부터 시작 가능합니다." },
  { n: "03", title: "캠페인 등록",          desc: "플랫폼·카테고리·기간을 선택하고 홍보 영상을 업로드합니다. 관리자 심사 후 즉시 집행됩니다." },
  { n: "04", title: "실시간 리포트 확인",   desc: "크리에이터별 배포 현황, 도달률, 포인트 소진 내역을 실시간으로 확인하세요." },
];

const COMPARISON = [
  { feature: "가입 방법",          exec: "직접 가입",           agency: "실행사 추천 코드 필수" },
  { feature: "캠페인 운영 주체",   exec: "자사 브랜드 캠페인",  agency: "클라이언트 복수 캠페인" },
  { feature: "포인트 충전",        exec: "직접 충전",           agency: "대행사 선불 충전" },
  { feature: "수수료 구조",        exec: "기본 단가 적용",      agency: "실행사 위탁 수수료 적용" },
  { feature: "대시보드 접근",      exec: "자사 대시보드",       agency: "통합 클라이언트 대시보드" },
  { feature: "크리에이터 매칭",    exec: "플랫폼 자동 매칭",   agency: "전담 매니저 배정 예정" },
  { feature: "대행사 수수료 수익", exec: "있음 (하위 대행사 시)",agency: "없음" },
];

const TESTIMONIALS = [
  {
    name: "임지은",
    role: "뷰티 브랜드 · 실행사",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&h=80&fit=crop&crop=face",
    text: "캠페인 세팅이 10분이면 끝나고 배포 현황을 실시간으로 확인할 수 있어요. 기존 마케팅 대비 CTR이 2배 올랐습니다.",
    badge: "CTR 4.2% 달성",
  },
  {
    name: "이준혁",
    role: "디지털 마케팅 대행사 대표",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
    text: "클라이언트 5곳의 캠페인을 하나의 계정으로 관리하니 효율적입니다. 실행사 코드로 연결되니 수수료 정산도 자동이에요.",
    badge: "5개 클라이언트 동시 운영",
  },
  {
    name: "박서준",
    role: "푸드 브랜드 마케터",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&crop=face",
    text: "TikTok과 인스타그램 동시 집행이 한 곳에서 됩니다. 예산 관리도 포인트 방식이라 과금 걱정이 없어요.",
    badge: "₩2,400,000 집행 완료",
  },
];

const FAQS = [
  { q: "대행사는 반드시 실행사 코드로 가입해야 하나요?", a: "네, 대행사는 반드시 상위 실행사의 추천 코드를 입력해야 가입이 완료됩니다. 실행사 코드 없이는 대행사 계정 생성이 불가합니다. 가입 후에는 실행사와 계층 관계가 자동으로 설정됩니다." },
  { q: "최소 캠페인 예산은 얼마인가요?", a: "최소 ₩150,000 상당의 포인트를 충전하면 첫 캠페인 집행이 가능합니다. 포인트는 배포 1건 완료 시마다 차감됩니다." },
  { q: "영상을 직접 제작해야 하나요?", a: "아닙니다. 플랫폼 내 크리에이터에게 영상 제작을 의뢰하거나, 직접 제작한 영상을 업로드하는 것 모두 가능합니다." },
  { q: "캠페인 집행 후 어떤 리포트를 받을 수 있나요?", a: "배포 건수, 크리에이터별 진행 현황, 플랫폼별 도달률, 포인트 소진 내역을 실시간 대시보드에서 확인할 수 있습니다." },
  { q: "대행사 수수료는 어떻게 정산되나요?", a: "대행사가 포인트를 충전하거나 캠페인을 집행할 때, 사전에 설정된 비율만큼 실행사에게 자동으로 수수료가 지급됩니다. 수수료율은 관리자가 설정합니다." },
  { q: "여러 클라이언트의 캠페인을 동시에 운영할 수 있나요?", a: "네, 대행사 계정에서는 복수 클라이언트의 캠페인을 통합 대시보드에서 동시 관리할 수 있습니다. 클라이언트별 예산과 결과를 분리해서 확인 가능합니다." },
  { q: "실행사가 되려면 포인트를 얼마나 충전해야 하나요?", a: "포인트를 1,000,000원(100만원) 이상 충전하면 자동으로 실행사 등급이 부여됩니다. 실행사는 대행사를 모집·초대할 수 있으며, 대행사의 캠페인 집행 시 자동 수수료 수익이 발생합니다. 100만원 미만 충전 시에는 대행사로 분류됩니다." },
  { q: "Facebook Reels도 배포가 가능한가요?", a: "네, VIBEFUNNY는 YouTube Shorts, Instagram Reels, TikTok, Facebook Reels 4대 플랫폼 동시 배포를 지원합니다. 하나의 캠페인으로 30억 이상의 Facebook MAU에 도달할 수 있습니다." },
  { q: "포인트는 만료되나요?", a: "충전된 포인트는 만료 기간 없이 유지됩니다. 실제 배포 건수가 완료될 때마다 포인트가 차감되며, 캠페인 종료 후 잔여 포인트는 다음 캠페인에 그대로 사용 가능합니다." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

/** 풀스크린 배경 이미지 섹션 */
function FullBg({
  src, overlay = "rgba(0,0,0,0.68)", children, id, className = "",
}: {
  src: string; overlay?: string; children: React.ReactNode; id?: string; className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative flex min-h-screen items-center overflow-hidden ${className}`}
      style={{
        backgroundImage: `url('${src}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 z-0" style={{ background: overlay }} />
      <div className="relative z-10 w-full">{children}</div>
    </section>
  );
}

/** 라이트 배경용 로고 (VIBE=다크, FUNNY=옐로우) */
function LogoLight() {
  return (
    <span className="text-xl font-black tracking-tight">
      <span className="text-gray-900">VIBE</span>
      <span style={{ color: "#f59e0b" }}>FUNNY</span>
    </span>
  );
}

/** 다크 배경용 로고 (VIBE=흰색, FUNNY=옐로우) */
function LogoDark() {
  return (
    <span className="text-xl font-black tracking-tight">
      <span className="text-white">VIBE</span>
      <span style={{ color: "#f59e0b" }}>FUNNY</span>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ForAdvertisersPage() {
  return (
    <div className="vf-marketing vf-advertisers">
      <style>{`
        @keyframes vfa-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .vfa-marquee { display:flex; width:max-content; animation: vfa-marquee 40s linear infinite; }
        .vfa-card { transition: transform .25s ease, box-shadow .25s ease; }
        .vfa-card:hover { transform:translateY(-4px); box-shadow:0 20px 40px rgba(0,0,0,.3); }
        details.vfa-faq > summary { list-style:none; }
        details.vfa-faq > summary::-webkit-details-marker { display:none; }
        .vfa-plus { transition:transform .2s ease; display:inline-block; }
        details[open] .vfa-plus { transform:rotate(45deg); }
      `}</style>

      {/* -------------- NAV (white bg → dark logo) -------------- */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <Link href="/"><LogoLight /></Link>
        <nav className="vfa-header-nav hidden items-center md:flex" aria-label="광고주 페이지 메뉴">
          <Link href="/"><IconHome size={14} />홈</Link>
          <Link href="#types">광고 유형</Link>
          <Link href="#benefits">주요 혜택</Link>
          <Link href="#process">진행 과정</Link>
        </nav>
        <div className="vfa-header-actions flex items-center gap-3">
          <Link href="/login" className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"><IconLogIn size={16} />로그인</Link>
          <Link href="/signup?role=advertiser" className="rounded-full px-5 py-2 text-sm font-bold text-black transition hover:opacity-80" style={{ background: "#f59e0b" }}><IconBuilding size={16} />광고주 가입</Link>
        </div>
      </header>

      {/* -------------- HERO -------------- */}
      <FullBg
        src={BG.hero}
        overlay="linear-gradient(155deg, rgba(0,0,0,0.78) 0%, rgba(10,0,30,0.72) 100%)"
        className="pt-16"
      >
        <div className="mx-auto max-w-5xl px-6 py-28 md:px-16">
          {/* label */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ borderColor: "rgba(245,158,11,0.35)", color: "#f59e0b" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            For Advertisers · 광고주 전용 플랫폼
          </div>

          <h1 className="text-[clamp(44px,8vw,100px)] font-black leading-[1.12] tracking-tight text-white">
            숏폼 광고,<br />
            <span style={{ color: "#f59e0b" }}>더 스마트하게</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            12,000명의 크리에이터가 브랜드를 알립니다.<br />
            YouTube · Instagram · TikTok · Facebook을 하나의 캠페인으로.
          </p>

          {/* quick stats */}
          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-4">
            {[
              { v: "12,000+", l: "크리에이터" },
              { v: "4대",     l: "플랫폼 동시 집행" },
              { v: "₩150K~", l: "최소 시작 예산" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border p-5 text-center" style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="text-2xl font-black" style={{ color: "#f59e0b" }}>{s.v}</div>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/signup?role=advertiser&type=execution_company" className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-black text-black transition hover:scale-105 hover:opacity-90" style={{ background: "#f59e0b" }}>
              <IconMegaphone size={16} strokeWidth={1.5} />
              실행사로 가입하기
            </Link>
            <Link href="/signup?role=advertiser&type=agency" className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-base font-semibold text-white transition hover:border-white/50" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              <IconBuilding size={16} strokeWidth={1.5} />
              대행사로 가입하기
            </Link>
          </div>
        </div>

        {/* bottom marquee */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-4" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="vfa-marquee">
            {Array.from({ length: 8 }).flatMap((_, i) =>
              ["숏폼 광고", "크리에이터 매칭", "4대 플랫폼", "실시간 리포트", "SHORTFORM MARKETING", "CAMPAIGN PLATFORM"].map((w) => (
                <span key={`${i}-${w}`} className="mr-10 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{w} ·</span>
              ))
            )}
          </div>
        </div>
      </FullBg>

      {/* -------------- WHY SHORTFORM (white bg) -------------- */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Why Shortform</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-6xl leading-[1.2]">
              왜 숏폼인가요?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-gray-500">
              모바일 시청 시간의 60% 이상이 숏폼. 가장 빠르게 성장하는 광고 채널입니다.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { num: "60%+", label: "모바일 동영상 중 숏폼 비중", Icon: IconTrendingUp },
              { num: "80억+", label: "4대 플랫폼 월 활성 사용자", Icon: IconUsers },
              { num: "4.2×", label: "일반 영상 대비 도달률", Icon: IconStar },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <div className="mb-3 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50">
                    <s.Icon size={26} strokeWidth={1.5} className="text-yellow-500" />
                  </div>
                </div>
                <div className="text-5xl font-black text-gray-900">{s.num}</div>
                <div className="mt-3 text-sm text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------- TYPE CARDS — 실행사 vs 대행사 -------------- */}
      <section id="types" className="px-6 py-24 md:px-16" style={{ background: "#f0f0f0" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Advertiser Types</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl leading-[1.25]">
              실행사와 대행사,<br />무엇이 다른가요?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
              자사 브랜드를 직접 홍보하는 실행사, 복수 클라이언트를 대신 집행하는 대행사.
            </p>
          </div>

          {/* Equal-height grid: items-stretch + flex flex-col on cards */}
          <div className="grid items-stretch gap-6 sm:grid-cols-2">

            {/* 실행사 */}
            <div className="flex flex-col overflow-hidden rounded-3xl border-2 border-yellow-300 bg-white p-8 shadow-sm">
              {/* header */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "#f59e0b" }}>
                  <IconMegaphone size={22} strokeWidth={1.5} className="text-gray-900" />
                </div>
                <div>
                  <div className="text-xl font-black text-gray-900">실행사</div>
                  <div className="text-xs font-medium text-gray-400">Execution Company</div>
                </div>
              </div>

              {/* description */}
              <p className="mt-5 text-sm leading-[1.7] text-gray-600">
                자사 브랜드의 광고를 직접 집행하는 기업·개인 사업자. 포인트를 충전하고 캠페인을 생성하면 플랫폼이 크리에이터를 자동 매칭합니다.
              </p>

              {/* feature list — flex-1 pushes button to bottom */}
              <ul className="mt-6 flex-1 space-y-3">
                {EXEC_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <IconCheckCircle size={15} className="mt-0.5 shrink-0 text-yellow-400" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* button always at bottom */}
              <Link
                href="/signup?role=advertiser&type=execution_company"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-black text-black transition hover:opacity-80"
                style={{ background: "#f59e0b" }}
              >
                <IconMegaphone size={15} strokeWidth={1.5} />
                실행사로 가입하기
              </Link>
            </div>

            {/* 대행사 */}
            <div className="flex flex-col overflow-hidden rounded-3xl border-2 border-orange-300 bg-white p-8 shadow-sm">
              {/* header */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-400">
                  <IconBuilding size={22} strokeWidth={1.5} className="text-white" />
                </div>
                <div>
                  <div className="text-xl font-black text-gray-900">대행사</div>
                  <div className="text-xs font-medium text-gray-400">Agency</div>
                </div>
              </div>

              {/* description */}
              <p className="mt-5 text-sm leading-[1.7] text-gray-600">
                복수 클라이언트의 광고를 대신 집행하는 광고 대행사. 실행사 추천 코드로 가입하면 계층 관계가 자동으로 설정됩니다.
              </p>

              {/* feature list — flex-1 pushes button to bottom */}
              <ul className="mt-6 flex-1 space-y-3">
                {AGENCY_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <IconCheckCircle size={15} className="mt-0.5 shrink-0 text-orange-400" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* button always at bottom */}
              <Link
                href="/signup?role=advertiser&type=agency"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-orange-400 py-3.5 text-sm font-black text-white transition hover:bg-orange-500"
              >
                <IconBuilding size={15} strokeWidth={1.5} />
                대행사로 가입하기
              </Link>
            </div>

          </div>
        </div>
      </section>


      {/* -------------- POINT TIER — 충전 금액 기준 -------------- */}
      <section className="px-6 py-20 md:px-16" style={{ background: "#fff7e6" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-yellow-600">Point Charging Tier</p>
            <h2 className="text-3xl font-black text-gray-900 md:text-5xl leading-[1.25]">
              포인트 충전 금액에 따른<br />
              <span style={{ color: "#f59e0b" }}>실행사 · 대행사 구분</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-gray-500">
              VIBEFUNNY 광고주는 포인트 충전 금액에 따라 실행사와 대행사로 구분됩니다.<br />충전 규모가 클수록 더 많은 권한과 혜택이 주어집니다.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 mb-10">
            {/* 실행사 */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-400 bg-white p-8 shadow-md">
              <div className="absolute right-0 top-0 rounded-bl-2xl px-4 py-2 text-xs font-black text-black" style={{ background: "#f59e0b" }}>
                EXECUTOR
              </div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "#f59e0b" }}>
                <IconMegaphone size={24} strokeWidth={1.5} className="text-black" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">실행사</h3>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <span className="text-sm font-medium text-gray-600">충전 기준</span>
                <span className="text-lg font-black" style={{ color: "#f59e0b" }}>₩1,000,000 이상</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                포인트를 <strong className="text-gray-900">100만원 이상</strong> 충전한 광고주는 실행사 등급을 획득합니다.
                실행사는 하위 대행사를 직접 모집·관리하고, 대행사의 캠페인 집행에서 <strong className="text-gray-900">자동 수수료 수익</strong>을 받을 수 있습니다.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "대행사 모집·초대 권한 보유",
                  "하위 대행사 자동 수수료 수익",
                  "우선 크리에이터 매칭 혜택",
                  "전담 캠페인 매니저 배정 (예정)",
                  "4대 플랫폼 동시 집행 전권",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <IconCheckCircle size={15} className="mt-0.5 shrink-0 text-yellow-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 대행사 */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-orange-300 bg-white p-8 shadow-md">
              <div className="absolute right-0 top-0 rounded-bl-2xl bg-orange-400 px-4 py-2 text-xs font-black text-white">
                AGENCY
              </div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400">
                <IconBuilding size={24} strokeWidth={1.5} className="text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">대행사</h3>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2">
                <span className="text-sm font-medium text-gray-600">충전 기준</span>
                <span className="text-lg font-black text-orange-500">₩1,000,000 미만</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                포인트를 <strong className="text-gray-900">100만원 미만</strong>으로 충전하거나 실행사 추천 코드로 가입하면 대행사로 분류됩니다.
                대행사는 복수 클라이언트의 캠페인을 효율적으로 운영하는 데 최적화되어 있습니다.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "실행사 추천 코드 필수 가입",
                  "복수 클라이언트 통합 관리",
                  "클라이언트별 예산·성과 분리",
                  "통합 리포트 제공",
                  "대행사 전용 대시보드",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <IconCheckCircle size={15} className="mt-0.5 shrink-0 text-orange-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 포인트 충전 단계 안내 */}
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-8">
            <h3 className="mb-5 text-center text-lg font-black text-gray-900">포인트 충전 단계별 혜택</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { range: "₩150,000 ~ ₩499,999", label: "스타터", color: "#6b7280", items: ["캠페인 1건 집행 가능", "기본 리포트 제공", "자동 크리에이터 매칭"] },
                { range: "₩500,000 ~ ₩999,999", label: "그로스", color: "#f97316", items: ["멀티 캠페인 동시 운영", "상세 분석 리포트", "우선 매칭 신청 가능"] },
                { range: "₩1,000,000+", label: "실행사 등급", color: "#f59e0b", items: ["대행사 모집 권한 획득", "수수료 자동 수익 발생", "전담 매니저 배정 예정", "최우선 크리에이터 배정"] },
              ].map((tier) => (
                <div key={tier.label} className="rounded-xl p-5 bg-white border" style={{ borderColor: tier.color === "#f59e0b" ? "#f59e0b" : "#e5e7eb", boxShadow: tier.color === "#f59e0b" ? "0 0 0 2px rgba(245,158,11,0.2)" : "none" }}>
                  <div className="mb-2 text-xs font-black uppercase tracking-widest" style={{ color: tier.color }}>{tier.label}</div>
                  <div className="mb-3 text-sm font-bold text-gray-900">{tier.range}</div>
                  <ul className="space-y-1.5">
                    {tier.items.map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="mt-0.5 shrink-0 font-black" style={{ color: tier.color }}>✓</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------- BENEFITS (dark image bg) -------------- */}
      <FullBg id="benefits" src={BG.benefits} overlay="rgba(0,0,0,0.80)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Why VIBEFUNNY</p>
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.2]">
              왜 VIBEFUNNY<br />여야 하나요?
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="vfa-card rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(245,158,11,0.15)" }}>
                  <b.Icon size={20} strokeWidth={1.5} className="text-yellow-400" />
                </div>
                <h3 className="mt-4 font-bold text-white">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      {/* -------------- PROCESS (white bg) -------------- */}
      <section id="process" className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">How It Works</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl leading-[1.25]">
              4단계로<br />캠페인을 시작하세요
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-black" style={{ background: "#f59e0b" }}>
                  {s.n}
                </div>
                <h3 className="font-black text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-[1.7] text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------- COMPARISON TABLE (dark bg) -------------- */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#0a0a0a" }}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-600">Comparison</p>
            <h2 className="text-4xl font-black text-white md:text-5xl">실행사 vs 대행사</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {/* header row */}
            <div className="grid grid-cols-3 px-6 py-4 text-xs font-black uppercase tracking-widest" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span className="text-gray-500">항목</span>
              <span className="text-center" style={{ color: "#f59e0b" }}>실행사</span>
              <span className="text-center text-orange-400">대행사</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className="grid grid-cols-3 px-6 py-4 text-sm"
                style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent", borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span className="text-gray-500">{row.feature}</span>
                <span className="text-center font-medium text-white">{row.exec}</span>
                <span className="text-center font-medium text-white">{row.agency}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------- TESTIMONIALS (dark image bg) -------------- */}
      <FullBg src={BG.testimonials} overlay="rgba(0,0,0,0.82)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Advertiser Voice</p>
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.2]">
              이미 사용 중인<br />광고주들의 이야기
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="vfa-card rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconStar key={i} size={13} strokeWidth={1.5} className="text-yellow-400" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>"{t.text}"</p>
                <div className="mt-6 flex items-center justify-between border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.avatar} alt={t.name} loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover" />
                    <div>
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.role}</div>
                    </div>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-bold text-black" style={{ background: "#f59e0b" }}>{t.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FullBg>


      {/* -------------- CAMPAIGN ROI SECTION -------------- */}
      <section className="px-6 py-20 md:px-16" style={{ background: "#0a0a0a" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-600">Campaign Performance</p>
            <h2 className="text-3xl font-black text-white md:text-5xl leading-[1.25]">
              숏폼 캠페인,<br /><span style={{ color: "#f59e0b" }}>이런 성과가 나옵니다</span>
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            {[
              { value: "4.2×", label: "일반 영상 대비 도달률", sub: "숏폼 포맷 알고리즘 우선 노출" },
              { value: "24H", label: "캠페인 집행 시작", sub: "관리자 심사 후 즉시 모집 시작" },
              { value: "98%", label: "광고주 재집행률", sub: "첫 캠페인 집행 후 재이용 비율" },
              { value: "3배", label: "CTR 개선 효과", sub: "배너 광고 대비 숏폼 클릭률" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-4xl font-black mb-2" style={{ color: "#f59e0b" }}>{kpi.value}</div>
                <div className="text-sm font-bold text-white mb-1">{kpi.label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{kpi.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-lg font-black text-white mb-5">캠페인 진행 현황 (실시간)</h3>
              <div className="space-y-4">
                {[
                  { label: "진행 중인 캠페인", value: "142건", color: "#10b981" },
                  { label: "이번 달 배포 완료", value: "8,420건", color: "#f59e0b" },
                  { label: "참여 크리에이터", value: "12,000+명", color: "#3b82f6" },
                  { label: "4대 플랫폼 누적 도달", value: "2.4억회+", color: "#ef4444" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between border-b pb-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{stat.label}</span>
                    <span className="font-black text-sm" style={{ color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-7" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <h3 className="text-lg font-black text-white mb-4">이런 브랜드가 이용합니다</h3>
              <div className="space-y-3">
                {[
                  { cat: "뷰티 / 코스메틱", desc: "제품 리뷰·튜토리얼 영상 숏폼 배포" },
                  { cat: "식품 / 음료", desc: "먹방·레시피 콘텐츠 바이럴 마케팅" },
                  { cat: "IT / 앱 서비스", desc: "앱 소개·기능 데모 숏폼 광고" },
                  { cat: "패션 / 라이프스타일", desc: "트렌드 코디·하울 영상 배포" },
                  { cat: "교육 / 자기계발", desc: "강의 홍보·지식 콘텐츠 마케팅" },
                ].map((cat) => (
                  <div key={cat.cat} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <span className="mt-0.5 shrink-0 font-black text-xs" style={{ color: "#f59e0b" }}>✓</span>
                    <div>
                      <div className="text-sm font-bold text-white">{cat.cat}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{cat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------- FAQ (white bg) -------------- */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">FAQ</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl">자주 묻는 질문</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="vfa-faq overflow-hidden rounded-xl border border-gray-200 bg-white">
                <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5 font-bold text-gray-900 transition hover:bg-gray-50">
                  <span>{faq.q}</span>
                  <span className="vfa-plus ml-4 shrink-0 text-2xl font-light text-gray-400">+</span>
                </summary>
                <div className="border-t border-gray-100 px-6 py-5 text-sm leading-relaxed text-gray-600">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* -------------- FINAL CTA (dramatic bg) -------------- */}
      <FullBg src={BG.cta} overlay="rgba(0,0,0,0.65)">
        <div className="mx-auto max-w-4xl px-6 py-32 text-center md:px-16">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Start Now</p>
          <h2 className="text-[clamp(44px,8vw,100px)] font-black leading-[1.12] text-white">
            지금 바로<br /><span style={{ color: "#f59e0b" }}>캠페인을</span><br />시작하세요
          </h2>
          <p className="mx-auto mt-8 max-w-md text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
            최소 ₩150,000 예산 · 심사 후 24시간 내 크리에이터 모집 시작
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup?role=advertiser&type=execution_company" className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-black text-black transition hover:scale-105" style={{ background: "#f59e0b" }}>
              <IconMegaphone size={16} strokeWidth={1.5} />
              실행사로 가입
            </Link>
            <Link href="/signup?role=advertiser&type=agency" className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-base font-bold text-white transition hover:border-white/50" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
              <IconBuilding size={16} strokeWidth={1.5} />
              대행사로 가입
            </Link>
          </div>
          <p className="mt-6 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-semibold underline hover:no-underline" style={{ color: "rgba(255,255,255,0.65)" }}>로그인</Link>
          </p>
        </div>
      </FullBg>

      {/* -------------- FOOTER (dark bg → white logo) -------------- */}
      <footer className="border-t px-6 py-12 md:px-12" style={{ background: "#060606", borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/"><LogoDark /></Link>
            <p className="mt-3 max-w-xs text-sm text-gray-600">숏폼 광고 크리에이터 플랫폼 · 광고주 전용</p>
          </div>
          <div className="flex gap-12 text-sm text-gray-600">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-700">광고주</p>
              <div className="space-y-2">
                <div><Link href="/signup?role=advertiser&type=execution_company" className="hover:text-white transition-colors">실행사 가입</Link></div>
                <div><Link href="/signup?role=advertiser&type=agency" className="hover:text-white transition-colors">대행사 가입</Link></div>
                <div><Link href="/login" className="hover:text-white transition-colors">로그인</Link></div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-700">플랫폼</p>
              <div className="space-y-2">
                <div>YouTube Shorts</div>
                <div>Instagram Reels</div>
                <div>TikTok</div>
                <div>Facebook Reels</div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
