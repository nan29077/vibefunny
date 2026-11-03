import type { Metadata } from "next";
import "./advertisers.css";
import Link from "next/link";
import {
  IconMegaphone, IconBuilding, IconBarChart, IconUsers, IconGlobe,
  IconZap, IconShield, IconGem, IconCheckCircle, IconDollarSign,
  IconTrendingUp, IconFilm, IconStar, IconCheck,
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
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "VIBEFUNNY 숏폼 영상 부업 플랫폼" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "광고주 센터 · VIBEFUNNY",
    description: "숏폼 배포 광고, AI 영상 제작 의뢰, 캠페인으로 브랜드를 알리세요.",
    images: ["/og.png"],
  },
};

// Generated campaign photography (portrait). PC canvas: 640px, mobile: full width.
const ADVERTISER_BG = "/images/marketing/advertiser-campaign-studio.webp";

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
  "실행사 추천 코드 입력 또는 '추천인 없음' 선택 후 가입",
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
  { n: "01", title: "계정 생성",           desc: "실행사 또는 대행사 유형 선택 후 가입. 대행사는 실행사 추천 코드를 입력하거나 '추천인 없음'을 선택하세요." },
  { n: "02", title: "포인트 충전",          desc: "캠페인 예산만큼 포인트를 충전합니다. 최소 ₩150,000부터 시작 가능합니다." },
  { n: "03", title: "캠페인 등록",          desc: "플랫폼·카테고리·기간을 선택하고 홍보 영상을 업로드합니다. 관리자 심사 후 즉시 집행됩니다." },
  { n: "04", title: "실시간 리포트 확인",   desc: "크리에이터별 배포 현황, 도달률, 포인트 소진 내역을 실시간으로 확인하세요." },
];

const COMPARISON = [
  { feature: "가입 방법",          exec: "직접 가입",           agency: "실행사 코드 또는 추천인 없음" },
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
  { q: "대행사는 반드시 실행사 코드로 가입해야 하나요?", a: "아니요. 대행사는 가입 시 상위 실행사의 추천 코드를 입력하거나 '추천인 없음'을 선택해 가입할 수 있습니다. 실행사 코드를 입력하면 해당 실행사와 계층 관계가 자동으로 설정되고, 대행사 집행에 대한 실행사 수수료가 정산됩니다." },
  { q: "최소 캠페인 예산은 얼마인가요?", a: "최소 ₩150,000 상당의 포인트를 충전하면 첫 캠페인 집행이 가능합니다. 포인트는 배포 1건 완료 시마다 차감됩니다." },
  { q: "영상을 직접 제작해야 하나요?", a: "아닙니다. 플랫폼 내 크리에이터에게 영상 제작을 의뢰하거나, 직접 제작한 영상을 업로드하는 것 모두 가능합니다." },
  { q: "캠페인 집행 후 어떤 리포트를 받을 수 있나요?", a: "배포 건수, 크리에이터별 진행 현황, 플랫폼별 도달률, 포인트 소진 내역을 실시간 대시보드에서 확인할 수 있습니다." },
  { q: "대행사 수수료는 어떻게 정산되나요?", a: "대행사가 포인트를 충전하거나 캠페인을 집행할 때, 사전에 설정된 비율만큼 실행사에게 자동으로 수수료가 지급됩니다. 수수료율은 관리자가 설정합니다." },
  { q: "여러 클라이언트의 캠페인을 동시에 운영할 수 있나요?", a: "네, 대행사 계정에서는 복수 클라이언트의 캠페인을 통합 대시보드에서 동시 관리할 수 있습니다. 클라이언트별 예산과 결과를 분리해서 확인 가능합니다." },
  { q: "실행사가 되려면 포인트를 얼마나 충전해야 하나요?", a: "충전 금액과 무관합니다. 광고주 유형(실행사/대행사)은 회원가입 시 직접 선택하며, 포인트 충전액에 따라 자동으로 바뀌지 않습니다. 실행사는 자신의 추천 코드로 대행사를 모집할 수 있고, 연결된 대행사의 캠페인 집행 시 관리자가 설정한 비율의 수수료가 자동 정산됩니다." },
  { q: "Facebook Reels도 배포가 가능한가요?", a: "네, VIBEFUNNY는 YouTube Shorts, Instagram Reels, TikTok, Facebook Reels 4대 플랫폼 동시 배포를 지원합니다. 하나의 캠페인으로 30억 이상의 Facebook MAU에 도달할 수 있습니다." },
  { q: "포인트는 만료되나요?", a: "충전된 포인트는 만료 기간 없이 유지됩니다. 실제 배포 건수가 완료될 때마다 포인트가 차감되며, 캠페인 종료 후 잔여 포인트는 다음 캠페인에 그대로 사용 가능합니다." },
];

const EXEC_TYPE_ITEMS = [
  "대행사 모집·초대 권한 보유",
  "하위 대행사 자동 수수료 수익",
  "우선 크리에이터 매칭 혜택",
  "전담 캠페인 매니저 배정 (예정)",
  "4대 플랫폼 동시 집행 전권",
];

const AGENCY_TYPE_ITEMS = [
  "실행사 코드 입력 또는 추천인 없음 가입",
  "복수 클라이언트 통합 관리",
  "클라이언트별 예산·성과 분리",
  "통합 리포트 제공",
  "대행사 전용 대시보드",
];

const TIERS = [
  { label: "스타터", range: "₩150,000 ~ ₩499,999", tone: "base",  items: ["캠페인 1건 집행 가능", "기본 리포트 제공", "자동 크리에이터 매칭"] },
  { label: "그로스", range: "₩500,000 ~ ₩999,999", tone: "mid",   items: ["멀티 캠페인 동시 운영", "상세 분석 리포트", "우선 매칭 신청 가능"] },
  { label: "스케일", range: "₩1,000,000+",         tone: "top",   items: ["대규모 멀티 캠페인 운영", "플랫폼별 상세 리포트", "전담 매니저 배정 예정", "최우선 크리에이터 배정"] },
];

const WHY_STATS = [
  { num: "60%+", label: "모바일 동영상 중 숏폼 비중", Icon: IconTrendingUp },
  { num: "80억+", label: "4대 플랫폼 월 활성 사용자", Icon: IconUsers },
  { num: "4.2×", label: "일반 영상 대비 도달률", Icon: IconStar },
];

const HERO_STATS = [
  { v: "12,000+", l: "크리에이터" },
  { v: "4대", l: "플랫폼 동시 집행" },
  { v: "₩150K~", l: "최소 시작 예산" },
];

const KPIS = [
  { value: "4.2×", label: "일반 영상 대비 도달률", sub: "숏폼 포맷 알고리즘 우선 노출" },
  { value: "24H", label: "캠페인 집행 시작", sub: "관리자 심사 후 즉시 모집 시작" },
  { value: "98%", label: "광고주 재집행률", sub: "첫 캠페인 집행 후 재이용 비율" },
  { value: "3배", label: "CTR 개선 효과", sub: "배너 광고 대비 숏폼 클릭률" },
];

const LIVE_STATS = [
  { label: "진행 중인 캠페인", value: "142건" },
  { label: "이번 달 배포 완료", value: "8,420건" },
  { label: "참여 크리에이터", value: "12,000+명" },
  { label: "4대 플랫폼 누적 도달", value: "2.4억회+" },
];

const BRAND_CATS = [
  { cat: "뷰티 / 코스메틱", desc: "제품 리뷰·튜토리얼 영상 숏폼 배포" },
  { cat: "식품 / 음료", desc: "먹방·레시피 콘텐츠 바이럴 마케팅" },
  { cat: "IT / 앱 서비스", desc: "앱 소개·기능 데모 숏폼 광고" },
  { cat: "패션 / 라이프스타일", desc: "트렌드 코디·하울 영상 배포" },
  { cat: "교육 / 자기계발", desc: "강의 홍보·지식 콘텐츠 마케팅" },
];

const MARQUEE_WORDS = ["숏폼 광고", "크리에이터 매칭", "4대 플랫폼", "실시간 리포트", "SHORTFORM MARKETING", "CAMPAIGN PLATFORM"];

// ─── Helpers ──────────────────────────────────────────────────────────────

/** 사진 배경 섹션 (PC: 640px 틀에 맞춘 고정 배경, 모바일: 고정 레이어) */
function PhotoSection({
  id, tone = "dark", children, className = "",
}: {
  id?: string; tone?: "dark" | "deep"; children: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={`vfa-photo vfa-photo--${tone} ${className}`} style={{ backgroundImage: `url('${ADVERTISER_BG}')` }}>
      <div className="vfa-photo-layer" aria-hidden />
      <div className="vfa-photo-shade" aria-hidden />
      <div className="vfa-photo-inner">{children}</div>
    </section>
  );
}

function SectionHead({ eyebrow, title, desc, light = false }: { eyebrow: string; title: React.ReactNode; desc?: React.ReactNode; light?: boolean }) {
  return (
    <div className={`vfa-head ${light ? "is-light" : ""}`}>
      <p className="vfa-eyebrow">{eyebrow}</p>
      <h2 className="vfa-h2">{title}</h2>
      {desc && <p className="vfa-lead">{desc}</p>}
    </div>
  );
}

function CheckList({ items, tone = "exec" }: { items: string[]; tone?: "exec" | "agency" | "light" }) {
  return (
    <ul className={`vfa-checks vfa-checks--${tone}`}>
      {items.map((item) => (
        <li key={item}>
          <IconCheckCircle size={16} strokeWidth={2} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** 라이트 배경용 로고 (마크 + 워드마크) */
function LogoLight() {
  return (
    <span className="vf-site-logo vfa-logo">
      <span>VIBE</span><b>FUNNY</b>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ForAdvertisersPage() {
  return (
    <div className="vf-adv">
      {/* 상단 바 */}
      <div className="vfa-topbar">
        <Link href="/" aria-label="바이브퍼니 홈"><LogoLight /></Link>
        <Link href="/login" className="vfa-topbar-login"><IconLogIn size={16} />로그인</Link>
      </div>

      {/* PC 오른쪽 메뉴 */}
      <nav className="vfa-side-nav" aria-label="광고주 페이지 메뉴">
        <Link href="/" className="vfa-side-brand" aria-label="바이브퍼니 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/brand/vibefunny-logo.svg" alt="VIBEFUNNY" className="vfa-side-logo-full" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/brand/vibefunny-mark.svg" alt="" aria-hidden className="vfa-side-logo-mark" />
        </Link>
        <Link href="/"><IconHome size={20} /><span>홈</span></Link>
        <Link href="#types"><IconBuilding size={20} /><span>광고 유형</span></Link>
        <Link href="#benefits"><IconGem size={20} /><span>주요 혜택</span></Link>
        <Link href="#process"><IconBarChart size={20} /><span>진행 과정</span></Link>
        <Link href="/signup?role=advertiser" className="vfa-side-cta"><IconMegaphone size={20} /><span>광고주 가입</span></Link>
      </nav>

      {/* 모바일 하단 메뉴 */}
      <nav className="vfa-mobile-nav" aria-label="광고주 모바일 메뉴">
        <Link href="/"><IconHome size={20} /><span>홈</span></Link>
        <Link href="#types"><IconBuilding size={20} /><span>광고 유형</span></Link>
        <Link href="#benefits"><IconGem size={20} /><span>혜택</span></Link>
        <Link href="#process"><IconBarChart size={20} /><span>과정</span></Link>
        <Link href="/signup?role=advertiser"><IconMegaphone size={20} /><span>가입</span></Link>
      </nav>

      {/* -------------- HERO -------------- */}
      <PhotoSection tone="deep" className="vfa-hero">
        <div className="vfa-wrap">
          <p className="vfa-pill"><span aria-hidden />For Advertisers · 광고주 전용 플랫폼</p>
          <h1 className="vfa-h1">숏폼 광고,<br /><em>더 스마트하게</em></h1>
          <p className="vfa-hero-lead">
            12,000명의 크리에이터가 브랜드를 알립니다.<br />
            YouTube · Instagram · TikTok · Facebook을 하나의 캠페인으로.
          </p>
          <div className="vfa-hero-stats">
            {HERO_STATS.map((s) => (
              <div key={s.l}>
                <strong>{s.v}</strong>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
          <div className="vfa-actions">
            <Link href="/signup?role=advertiser&type=execution_company" className="vfa-btn vfa-btn--primary">
              <IconMegaphone size={17} strokeWidth={1.8} />실행사로 가입하기
            </Link>
            <Link href="/signup?role=advertiser&type=agency" className="vfa-btn vfa-btn--ghost">
              <IconBuilding size={17} strokeWidth={1.8} />대행사로 가입하기
            </Link>
          </div>
        </div>
        <div className="vfa-marquee-bar" aria-hidden>
          <div className="vfa-marquee">
            {Array.from({ length: 8 }).flatMap((_, i) =>
              MARQUEE_WORDS.map((w) => <span key={`${i}-${w}`}>{w} ·</span>)
            )}
          </div>
        </div>
      </PhotoSection>

      {/* -------------- WHY SHORTFORM -------------- */}
      <section className="vfa-section">
        <div className="vfa-wrap">
          <SectionHead
            eyebrow="Why Shortform"
            title="왜 숏폼인가요?"
            desc="모바일 시청 시간의 60% 이상이 숏폼. 가장 빠르게 성장하는 광고 채널입니다."
          />
          <div className="vfa-why-grid">
            {WHY_STATS.map((s) => (
              <div key={s.label} className="vfa-card vfa-why">
                <div className="vfa-icon"><s.Icon size={22} strokeWidth={1.7} /></div>
                <strong>{s.num}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------- TYPE CARDS — 실행사 vs 대행사 -------------- */}
      <section id="types" className="vfa-section vfa-section--alt">
        <div className="vfa-wrap">
          <SectionHead
            eyebrow="Advertiser Types"
            title={<>실행사와 대행사,<br />무엇이 다른가요?</>}
            desc="자사 브랜드를 직접 홍보하는 실행사, 복수 클라이언트를 대신 집행하는 대행사."
          />
          <div className="vfa-stack">
            <article className="vfa-card vfa-type vfa-type--exec">
              <header className="vfa-type-head">
                <div className="vfa-icon vfa-icon--solid"><IconMegaphone size={22} strokeWidth={1.7} /></div>
                <div>
                  <h3>실행사</h3>
                  <p>Execution Company</p>
                </div>
              </header>
              <p className="vfa-body">
                자사 브랜드의 광고를 직접 집행하는 기업·개인 사업자. 포인트를 충전하고 캠페인을 생성하면 플랫폼이 크리에이터를 자동 매칭합니다.
              </p>
              <CheckList items={EXEC_ITEMS} tone="exec" />
              <Link href="/signup?role=advertiser&type=execution_company" className="vfa-btn vfa-btn--primary vfa-btn--block">
                <IconMegaphone size={16} strokeWidth={1.8} />실행사로 가입하기
              </Link>
            </article>

            <article className="vfa-card vfa-type vfa-type--agency">
              <header className="vfa-type-head">
                <div className="vfa-icon vfa-icon--solid"><IconBuilding size={22} strokeWidth={1.7} /></div>
                <div>
                  <h3>대행사</h3>
                  <p>Agency</p>
                </div>
              </header>
              <p className="vfa-body">
                복수 클라이언트의 광고를 대신 집행하는 광고 대행사. 실행사 추천 코드로 가입하면 계층 관계가 자동으로 설정되며, 코드 없이 &lsquo;추천인 없음&rsquo;으로도 가입할 수 있습니다.
              </p>
              <CheckList items={AGENCY_ITEMS} tone="agency" />
              <Link href="/signup?role=advertiser&type=agency" className="vfa-btn vfa-btn--agency vfa-btn--block">
                <IconBuilding size={16} strokeWidth={1.8} />대행사로 가입하기
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* -------------- ADVERTISER TYPE — 가입 유형 기준 -------------- */}
      <section className="vfa-section vfa-section--warm">
        <div className="vfa-wrap">
          <SectionHead
            eyebrow="Advertiser Type"
            title={<>가입 유형에 따른<br /><em>실행사 · 대행사 구분</em></>}
            desc={<>VIBEFUNNY 광고주 유형은 회원가입 시 직접 선택합니다.<br />포인트 충전 금액에 따라 유형이 자동으로 바뀌지 않습니다.</>}
          />
          <div className="vfa-stack">
            <article className="vfa-card vfa-type vfa-type--exec">
              <header className="vfa-type-head">
                <div className="vfa-icon vfa-icon--solid"><IconMegaphone size={22} strokeWidth={1.7} /></div>
                <div>
                  <h3>실행사</h3>
                  <p>Executor</p>
                </div>
              </header>
              <dl className="vfa-join">
                <dt>가입 방법</dt>
                <dd>직접 가입</dd>
              </dl>
              <p className="vfa-body">
                가입 시 <strong>실행사</strong>를 선택하면 별도 코드 없이 바로 가입됩니다.
                실행사는 추천 코드로 하위 대행사를 모집·관리하고, 연결된 대행사의 캠페인 집행에서 <strong>자동 수수료 수익</strong>을 받을 수 있습니다.
              </p>
              <CheckList items={EXEC_TYPE_ITEMS} tone="exec" />
            </article>

            <article className="vfa-card vfa-type vfa-type--agency">
              <header className="vfa-type-head">
                <div className="vfa-icon vfa-icon--solid"><IconBuilding size={22} strokeWidth={1.7} /></div>
                <div>
                  <h3>대행사</h3>
                  <p>Agency</p>
                </div>
              </header>
              <dl className="vfa-join">
                <dt>가입 방법</dt>
                <dd>실행사 코드 · 추천인 없음</dd>
              </dl>
              <p className="vfa-body">
                가입 시 <strong>대행사</strong>를 선택하고 실행사 추천 코드를 입력하거나 &lsquo;추천인 없음&rsquo;을 선택하면 됩니다.
                대행사는 복수 클라이언트의 캠페인을 효율적으로 운영하는 데 최적화되어 있습니다.
              </p>
              <CheckList items={AGENCY_TYPE_ITEMS} tone="agency" />
            </article>
          </div>

          {/* 포인트 충전 단계 안내 */}
          <div className="vfa-tiers">
            <h3 className="vfa-h3">포인트 충전 단계별 혜택</h3>
            <div className="vfa-tier-list">
              {TIERS.map((tier) => (
                <div key={tier.label} className={`vfa-tier vfa-tier--${tier.tone}`}>
                  <div className="vfa-tier-top">
                    <span className="vfa-tier-label">{tier.label}</span>
                    <span className="vfa-tier-range">{tier.range}</span>
                  </div>
                  <ul>
                    {tier.items.map((item) => (
                      <li key={item}><IconCheck size={13} strokeWidth={2.4} aria-hidden />{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------- BENEFITS -------------- */}
      <PhotoSection id="benefits">
        <div className="vfa-wrap">
          <SectionHead light eyebrow="Why VIBEFUNNY" title={<>왜 VIBEFUNNY<br />여야 하나요?</>} />
          <div className="vfa-benefit-grid">
            {BENEFITS.map((b) => (
              <div key={b.title} className="vfa-glass vfa-benefit">
                <div className="vfa-icon vfa-icon--glass"><b.Icon size={20} strokeWidth={1.7} /></div>
                <div>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PhotoSection>

      {/* -------------- PROCESS -------------- */}
      <section id="process" className="vfa-section">
        <div className="vfa-wrap">
          <SectionHead eyebrow="How It Works" title={<>4단계로<br />캠페인을 시작하세요</>} />
          <ol className="vfa-steps">
            {PROCESS.map((s) => (
              <li key={s.n} className="vfa-card vfa-step">
                <span className="vfa-step-num">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------- COMPARISON TABLE -------------- */}
      <section className="vfa-section vfa-section--dark">
        <div className="vfa-wrap">
          <SectionHead light eyebrow="Comparison" title="실행사 vs 대행사" />
          <div className="vfa-table-wrap">
            <table className="vfa-table">
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col" className="is-exec">실행사</th>
                  <th scope="col" className="is-agency">대행사</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td>{row.exec}</td>
                    <td>{row.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* -------------- TESTIMONIALS -------------- */}
      <PhotoSection>
        <div className="vfa-wrap">
          <SectionHead light eyebrow="Advertiser Voice" title={<>이미 사용 중인<br />광고주들의 이야기</>} />
          <div className="vfa-stack">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="vfa-glass vfa-quote">
                <div className="vfa-stars" aria-label="별점 5점">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconStar key={i} size={14} strokeWidth={1.6} aria-hidden />
                  ))}
                </div>
                <blockquote>&ldquo;{t.text}&rdquo;</blockquote>
                <figcaption>
                  <span className="vfa-avatar" aria-hidden>
                    {t.name.slice(0, 1)}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.avatar} alt="" loading="lazy" decoding="async" />
                  </span>
                  <span className="vfa-who">
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </span>
                  <span className="vfa-badge">{t.badge}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </PhotoSection>

      {/* -------------- CAMPAIGN ROI -------------- */}
      <section className="vfa-section vfa-section--dark">
        <div className="vfa-wrap">
          <SectionHead light eyebrow="Campaign Performance" title={<>숏폼 캠페인,<br /><em>이런 성과가 나옵니다</em></>} />
          <div className="vfa-kpi-grid">
            {KPIS.map((kpi) => (
              <div key={kpi.label} className="vfa-kpi">
                <strong>{kpi.value}</strong>
                <span className="vfa-kpi-label">{kpi.label}</span>
                <span className="vfa-kpi-sub">{kpi.sub}</span>
              </div>
            ))}
          </div>
          <div className="vfa-stack">
            <div className="vfa-dark-card">
              <h3 className="vfa-h3 is-light">캠페인 진행 현황 (실시간)</h3>
              <dl className="vfa-live">
                {LIVE_STATS.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="vfa-dark-card vfa-dark-card--honey">
              <h3 className="vfa-h3 is-light">이런 브랜드가 이용합니다</h3>
              <ul className="vfa-cats">
                {BRAND_CATS.map((cat) => (
                  <li key={cat.cat}>
                    <IconCheck size={14} strokeWidth={2.4} aria-hidden />
                    <div>
                      <strong>{cat.cat}</strong>
                      <span>{cat.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* -------------- FAQ -------------- */}
      <section className="vfa-section">
        <div className="vfa-wrap">
          <SectionHead eyebrow="FAQ" title="자주 묻는 질문" />
          <div className="vfa-faqs">
            {FAQS.map((faq) => (
              <details key={faq.q} className="vfa-faq">
                <summary>
                  <span>{faq.q}</span>
                  <span className="vfa-plus" aria-hidden>+</span>
                </summary>
                <div>{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* -------------- FINAL CTA -------------- */}
      <PhotoSection className="vfa-cta">
        <div className="vfa-wrap">
          <p className="vfa-eyebrow is-light">Start Now</p>
          <h2 className="vfa-h1">지금 바로<br /><em>캠페인을</em><br />시작하세요</h2>
          <p className="vfa-hero-lead">최소 ₩150,000 예산 · 심사 후 24시간 내 크리에이터 모집 시작</p>
          <div className="vfa-actions is-center">
            <Link href="/signup?role=advertiser&type=execution_company" className="vfa-btn vfa-btn--primary">
              <IconMegaphone size={17} strokeWidth={1.8} />실행사로 가입
            </Link>
            <Link href="/signup?role=advertiser&type=agency" className="vfa-btn vfa-btn--ghost">
              <IconBuilding size={17} strokeWidth={1.8} />대행사로 가입
            </Link>
          </div>
          <p className="vfa-login-hint">
            이미 계정이 있으신가요? <Link href="/login">로그인</Link>
          </p>
        </div>
      </PhotoSection>

      {/* -------------- FOOTER -------------- */}
      <footer className="vfa-footer">
        <div className="vfa-wrap">
          <div className="vfa-footer-brand">
            <Link href="/" aria-label="바이브퍼니 홈">
              <span className="vf-site-logo vfa-logo is-dark"><span>VIBE</span><b>FUNNY</b></span>
            </Link>
            <p>숏폼 광고 크리에이터 플랫폼 · 광고주 전용</p>
          </div>
          <div className="vfa-footer-cols">
            <div>
              <p className="vfa-footer-title">광고주</p>
              <Link href="/signup?role=advertiser&type=execution_company">실행사 가입</Link>
              <Link href="/signup?role=advertiser&type=agency">대행사 가입</Link>
              <Link href="/login">로그인</Link>
            </div>
            <div>
              <p className="vfa-footer-title">플랫폼</p>
              <span>YouTube Shorts</span>
              <span>Instagram Reels</span>
              <span>TikTok</span>
              <span>Facebook Reels</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
