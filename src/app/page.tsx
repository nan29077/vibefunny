import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/routes";
import { logoutAction } from "@/lib/actions/auth-actions";
import { HoneyHeroCarousel } from "@/components/marketing/honey-hero-carousel";
import { MobileMainMenu, MobilePublicNav } from "@/components/marketing/mobile-main-menu";
import { SupportWidget } from "@/components/support/support-widget";
import { IconBarChart, IconCalendar, IconGlobe, IconHome, IconInfo, IconLogIn, IconLogOut, IconMegaphone, IconPieChart } from "@/components/icons";

export const dynamic = "force-dynamic";

const BG = {
  hero:         "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1920&q=85&fit=crop&auto=format",
  aiExpert:     "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=85&fit=crop&auto=format",
  aiVideo:      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=85&fit=crop&auto=format",
  shortform:    "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=1920&q=85&fit=crop&auto=format",
  referral:     "https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=1920&q=85&fit=crop&auto=format",
  stats:        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85&fit=crop&auto=format",
  platforms:    "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&q=85&fit=crop&auto=format",
  testimonials: "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1920&q=85&fit=crop&auto=format",
  advertiser:   "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=85&fit=crop&auto=format",
  faq:          "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=85&fit=crop&auto=format",
  cta:          "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=85&fit=crop&auto=format",
  roadmap:      "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=85&fit=crop&auto=format",
  income:       "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1920&q=85&fit=crop&auto=format",
};

const PLATFORMS = [
  { name: "YouTube Shorts", color: "#FF0000", Brand: BrandYouTube, users: "20억+", desc: "세계 최대 동영상 플랫폼", earn: "조회당 수익 + 배포 단가" },
  { name: "Instagram Reels", color: "#C13584", Brand: BrandInstagram, users: "20억+", desc: "글로벌 SNS 숏폼", earn: "고정 배포 단가 지급" },
  { name: "TikTok", color: "#69C9D0", Brand: BrandTikTok, users: "10억+", desc: "Z세대 숏폼 1위", earn: "신규 채널도 즉시 참여" },
  { name: "Facebook Reels", color: "#1877F2", Brand: BrandFacebook, users: "30억+", desc: "글로벌 최대 SNS 플랫폼", earn: "대규모 타겟팅 수익" },
];

const TESTIMONIALS = [
  { name: "이민준", role: "크리에이터 · 3개월 차", income: "월 68만원", quote: "처음에는 반신반의했는데, AI 영상 제작법 배우고 나서 첫 달부터 수익이 나왔어요. 본업 말고 진짜 부업이 생긴 기분입니다. 3개월 지난 지금은 월 68만원 정도 들어와요." },
  { name: "김서연", role: "크리에이터 · 6개월 차", income: "월 140만원", quote: "숏폼 배포 수익이 생각보다 꾸준해서 놀랐어요. 매월 안정적으로 들어오니까 부담 없이 계속할 수 있어요. 지금은 추천 수당까지 합쳐서 월 140만원 수준이에요." },
  { name: "박도현", role: "크리에이터 · 1년 차", income: "월 290만원", quote: "추천 수당이 쌓이면서 영상 안 해도 매달 수익이 들어와요. 1년 넘으니까 수익 파이프라인이 세 개 다 돌아가는 느낌입니다. 솔직히 본업 수입을 넘어섰어요." },
  { name: "최유리", role: "크리에이터 · 2개월 차", income: "월 45만원", quote: "영상 편집 경험이 전혀 없었는데 AI 도구 덕분에 생각보다 빨리 시작했어요. 가입하고 2주 만에 첫 수익이 들어왔고, 지금은 꾸준히 월 40~50만원 버는 중이에요." },
  { name: "정재원", role: "크리에이터 · 9개월 차", income: "월 210만원", quote: "부업으로 시작했는데 지금은 반전업 수준이에요. 추천 네트워크가 50명을 넘으니까 제가 영상 안 올려도 매달 수익이 들어오는 구조가 됐습니다." },
  { name: "한소희", role: "크리에이터 · 4개월 차", income: "월 95만원", quote: "직장 다니면서 틈틈이 AI 영상 만들어서 올리는데 한 달에 95만원 정도 됩니다. 퇴근 후 1~2시간 투자하는 것치고는 만족해요. 올해 목표는 월 150만원입니다." },
];

const FAQS = [
  { q: "영상 제작 경험이 없어도 시작할 수 있나요?", a: "네, 가능합니다. 가입 후 제공되는 AI 영상 제작 가이드를 따라하면 경험이 없어도 충분히 시작할 수 있습니다. 실제로 활동 크리에이터의 60% 이상이 영상 경험 없이 시작했습니다." },
  { q: "수익은 어떻게 정산되나요?", a: "배포 1건당 고정 단가가 지급되며, 수익은 지갑에 적립됩니다. 일정 금액 이상 쌓이면 출금 신청을 통해 현금으로 받을 수 있습니다. 정산 주기는 매월 말 기준입니다." },
  { q: "첫 수익까지 얼마나 걸리나요?", a: "평균적으로 가입 후 1~2주 안에 첫 수익이 발생합니다. 첫 영상 배포가 완료되는 즉시 단가가 적립되며, 추천인 코드를 활용하면 가입 당일에도 추천 수당을 받을 수 있습니다." },
  { q: "어떤 종류의 영상을 만들 수 있나요?", a: "광고 영상, 브랜드 소개 영상, 제품 홍보 영상 등 다양한 카테고리의 숏폼 콘텐츠를 제작하고 납품할 수 있습니다. 15초~60초 분량의 숏폼이 주를 이룹니다." },
  { q: "월 얼마 정도 벌 수 있나요?", a: "활동 수준에 따라 다릅니다. 가볍게 시작하는 크리에이터는 월 30~70만원, 적극적으로 활동하면 월 100~200만원, 추천 네트워크까지 구축하면 월 300만원 이상도 가능합니다." },
  { q: "크리에이터 가입 조건이 있나요?", a: "특별한 조건은 없습니다. 누구나 가입하고 활동을 시작할 수 있습니다. 채널 구독자 수, 팔로워 수 등 기존 SNS 지표와 무관하게 참여 가능합니다." },
  { q: "추천인 코드는 어떻게 사용하나요?", a: "가입 시 추천인 코드 입력란에 코드를 입력하면 됩니다. 추천인은 가입 완료 즉시 수당이 지급됩니다. 내가 초대한 크리에이터의 활동이 활발할수록 추천 네트워크 효과가 커집니다." },
  { q: "AI 영상 제작에 어떤 도구를 사용하나요?", a: "Gemini, Veo, Sora, Runway 등 최신 AI 영상 생성 도구를 활용합니다. 가입 후 제공되는 가이드에서 무료 또는 저렴하게 이용할 수 있는 AI 도구 목록과 사용법을 확인할 수 있습니다." },
  { q: "스마트폰만으로도 가능한가요?", a: "가능합니다. AI 영상 제작 도구 대부분이 모바일을 지원하며, 배포와 수익 확인도 모바일에서 가능합니다. 고가 장비 없이도 충분히 활동할 수 있습니다." },
  { q: "부업 이외에 전업으로도 가능한가요?", a: "충분히 가능합니다. 현재 활동 중인 크리에이터 중 약 15%는 VIBEFUNNY를 주 수입원으로 활동하고 있습니다. 세 파이프라인을 모두 적극 운영하면 전업 수준의 수익이 가능합니다." },
];

const ROADMAP_STEPS = [
  { day: "D+1",   title: "가입 & 온보딩",    desc: "5분 가입 완료 후 AI 영상 제작 가이드를 확인합니다. 추천 코드를 지인과 공유하면 이날부터 추천 수당 발생 가능.", badge: "START",     color: "#f59e0b" },
  { day: "D+7",   title: "첫 영상 납품",      desc: "AI 도구로 첫 숏폼 영상을 제작해 납품합니다. 납품 완료 즉시 수익이 지갑에 적립됩니다.",                             badge: "첫 수익",   color: "#10b981" },
  { day: "D+14",  title: "배포 루틴 구축",    desc: "YouTube Shorts · Instagram Reels · TikTok · Facebook 4개 플랫폼에 동시 배포 루틴을 잡습니다. 매 배포마다 단가가 쌓입니다.",            badge: "배포 시작",  color: "#3b82f6" },
  { day: "D+30",  title: "첫 정산",           desc: "한 달간의 AI 납품 + 배포 + 추천 수당을 합산해 첫 정산을 받습니다. 대부분의 크리에이터가 30~80만원 내외.",          badge: "첫 정산",   color: "#8b5cf6" },
  { day: "D+90",  title: "수익 가속화",       desc: "추천 네트워크가 확장되고 AI 납품 퀄리티가 높아지면서 수익이 빠르게 성장합니다. 평균 월 100~200만원대.",             badge: "성장 구간",  color: "#ef4444" },
  { day: "D+180", title: "안정적 월 수익",    desc: "영상 납품·배포·추천 세 파이프라인이 자동화됩니다. 내가 쉬는 날에도 수익이 들어오는 구조.",                          badge: "자동화 수익", color: "#f59e0b" },
];

const INCOME_TIERS = [
  {
    tier: "입문", label: "가볍게 시작", monthly: "30 ~ 80만원",
    color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)",
    items: [
      { act: "AI 영상 납품", val: "월 3~5편",   earn: "15~30만원" },
      { act: "숏폼 배포",    val: "월 10~20건", earn: "10~25만원" },
      { act: "추천 수당",    val: "월 1~3명",   earn: "5~15만원"  },
    ],
    desc: "퇴근 후 하루 1시간 투자",
  },
  {
    tier: "활발", label: "꾸준히 활동", monthly: "100 ~ 200만원",
    color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)",
    highlight: true,
    items: [
      { act: "AI 영상 납품", val: "월 10~15편",  earn: "50~90만원" },
      { act: "숏폼 배포",    val: "월 30~50건", earn: "40~70만원" },
      { act: "추천 수당",    val: "월 5~15명",  earn: "25~60만원" },
    ],
    desc: "하루 2~3시간, 주 5일 활동",
  },
  {
    tier: "전업급", label: "풀타임 크리에이터", monthly: "250 ~ 400만원+",
    color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)",
    items: [
      { act: "AI 영상 납품", val: "월 20편+",   earn: "100~160만원" },
      { act: "숏폼 배포",    val: "월 60건+",   earn: "80~120만원"  },
      { act: "추천 수당",    val: "누적 30명+", earn: "80~130만원"  },
    ],
    desc: "추천 네트워크 포함 풀타임 운영",
  },
];

const MARQUEE_WORDS = ["AI 영상 제작", "숏폼 배포 수익", "추천 수당", "SHORTFORM INCOME", "CREATOR PLATFORM", "YouTube Shorts", "Instagram Reels", "TikTok", "Facebook Reels"];

function IcoRobot({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="13" rx="2" /><path d="M8 8V5a4 4 0 0 1 8 0v3" />
      <circle cx="9" cy="14" r="1.5" /><circle cx="15" cy="14" r="1.5" /><path d="M9 17.5h6" />
    </svg>
  );
}
function IcoFileText({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3a2 2 0 0 1 4 0" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}
function IcoBroadcast({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" />
    </svg>
  );
}
function IcoGear({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.52 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function IcoSprout({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-9"/>
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-2-3.7.7-.1 3.3-.2 4.5.3z"/>
      <path d="M14.1 6a7 7 0 0 1 1.5 4.7c-1.7.1-3.1-.4-4.1-1.3-.9-.8-1.5-2.2-1-3.8.8-.1 2.6 0 3.6.4z"/>
    </svg>
  );
}
function IcoTrendingUp({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function IcoAward({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  );
}
function IcoCrown({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20"/><path d="M5 20V8l7 3 5-7 5 7-7-3-3 15"/>
    </svg>
  );
}

/* ─── 실제 SNS 브랜드 아이콘 ─── */
function BrandYouTube({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="YouTube">
      <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
      <path fill="#fff" d="M9.545 15.568V8.432L15.818 12z"/>
    </svg>
  );
}
function BrandInstagram({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Instagram">
      <defs>
        <radialGradient id="vfIgGrad" cx="0.3" cy="1" r="1.1">
          <stop offset="0" stopColor="#fdf497"/><stop offset="0.12" stopColor="#fdf497"/>
          <stop offset="0.45" stopColor="#fd5949"/><stop offset="0.62" stopColor="#d6249f"/>
          <stop offset="0.95" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#vfIgGrad)"/>
      <rect x="6.5" y="6.5" width="11" height="11" rx="5.5" fill="none" stroke="#fff" strokeWidth="1.8"/>
      <circle cx="17.3" cy="6.7" r="1.2" fill="#fff"/>
    </svg>
  );
}
function BrandTikTok({ size = 44 }: { size?: number }) {
  const d = "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="TikTok">
      <path d={d} fill="#25F4EE" transform="translate(-1,0.7)"/>
      <path d={d} fill="#FE2C55" transform="translate(1,-0.7)"/>
      <path d={d} fill="#fff"/>
    </svg>
  );
}
function BrandFacebook({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Facebook">
      <circle cx="12" cy="12" r="11" fill="#1877F2"/>
      <path fill="#fff" d="M15.12 12.5l.45-2.9h-2.78V7.72c0-.79.39-1.57 1.63-1.57h1.27V3.68s-1.15-.2-2.25-.2c-2.3 0-3.8 1.39-3.8 3.91V9.6H7.08v2.9h2.56V21h3.15v-8.5z"/>
    </svg>
  );
}

/* ─── 라인형 심플 아이콘 ─── */
function Ln({ size = 28, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function IcoLnSubtitle({ size = 24 }: { size?: number }) {
  return <Ln size={size}><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6 14.5h5M14 14.5h4M6 10.5h12"/></Ln>;
}
function IcoLnClock({ size = 24 }: { size?: number }) {
  return <Ln size={size}><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3.2 2"/></Ln>;
}
function IcoLnChart({ size = 24 }: { size?: number }) {
  return <Ln size={size}><path d="M3.5 3.5v17h17"/><path d="M8 16v-4M13 16V9M18 16V6"/></Ln>;
}
function IcoLnPhone({ size = 24 }: { size?: number }) {
  return <Ln size={size}><rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/></Ln>;
}
function IcoLnTrendDown({ size = 24 }: { size?: number }) {
  return <Ln size={size}><polyline points="3 7 9.5 13.5 13.5 9.5 21 17"/><polyline points="15 17 21 17 21 11"/></Ln>;
}
function IcoLnPlay({ size = 24 }: { size?: number }) {
  return <Ln size={size}><rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9l6 3-6 3z"/></Ln>;
}
function IcoLnCamera({ size = 24 }: { size?: number }) {
  return <Ln size={size}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="0.9"/></Ln>;
}
function IcoLnMusic({ size = 24 }: { size?: number }) {
  return <Ln size={size}><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></Ln>;
}
function IcoLnFacebook({ size = 24 }: { size?: number }) {
  return <Ln size={size}><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M14.5 8h-1.6A1.6 1.6 0 0 0 11.3 9.6V12m-2 0h5m-3.2 0v6"/></Ln>;
}
function IcoLnGlobe({ size = 24 }: { size?: number }) {
  return <Ln size={size}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9s1.4-6.6 3.9-9z"/></Ln>;
}

const EXPERT_STEPS = [
  { Icon: IcoRobot,    step: "STEP 1", title: "AI 도구 마스터",    desc: "Gemini·Veo·Runway 등 무료 AI 영상 도구를 완전히 익힙니다. 프롬프트 작성법과 영상 퀄리티를 높이는 핵심 기술을 단기간에 습득합니다." },
  { Icon: IcoFileText, step: "STEP 2", title: "숏폼 콘텐츠 기획",  desc: "광고주가 원하는 포맷, 트렌드 분석, 15~60초 숏폼에 최적화된 스크립트와 영상 구성 노하우를 현장에서 쌓아갑니다." },
  { Icon: IcoBroadcast, step: "STEP 3", title: "멀티 플랫폼 배포", desc: "YouTube Shorts·Instagram Reels·TikTok·Facebook Reels 동시 배포 전략. 각 플랫폼 알고리즘에 맞는 최적화 기법으로 배포 수익을 극대화합니다." },
  { Icon: IcoGear,     step: "STEP 4", title: "수익 자동화 완성",  desc: "추천 네트워크 구축 + 배포 루틴화로 직접 영상을 만들지 않아도 수익이 들어오는 파이프라인을 완성합니다." },
];

function MobileFixedBackground({ src }: { src: string }) {
  return <div className="vf-mobile-fixed-section-bg" style={{ backgroundImage: `url('${src}')` }} aria-hidden />;
}

function FullBg({
  src, overlay = "rgba(0,0,0,0.62)", children, className = "", id,
}: {
  src: string; overlay?: string; children: React.ReactNode; className?: string; id?: string;
}) {
  return (
    <section
      id={id}
      className={`vf-fixed-photo-section relative flex min-h-screen items-center overflow-hidden ${className}`}
      style={{ backgroundImage: `url('${src}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <MobileFixedBackground src={src} />
      <div className="absolute inset-0 z-0" style={{ background: overlay }} />
      <div className="relative z-10 w-full">{children}</div>
    </section>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.45)" }}>{text}</p>;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.6)" }}>
      {children}
    </span>
  );
}

export default function HomePage() {
  const db = getDb();
  const currentUser = getCurrentUser();
  const dashHref = currentUser ? roleHome(currentUser.role) : null;
  const announcement = db.settings.site_announcement;
  const revenueStats = db.settings.site_revenue_stats ?? [];

  const defaultStats = [
    { key: "a", label: "글로벌 배포 플랫폼",     value: "4",    suffix: "개"   },
    { key: "b", label: "숏폼 월 시청자",          value: "30억", suffix: "+"   },
    { key: "c", label: "크리에이터 평균 월 수익", value: "148",  suffix: "만원" },
    { key: "d", label: "기본 가입비",             value: "0",    suffix: "원"   },
  ];
  const stats = revenueStats.length > 0 ? revenueStats : defaultStats;

  return (
    <div className="vf-marketing vf-home">
      <div className="vf-site-topbar">
        <MobileMainMenu myPageHref={dashHref ?? "/login"} />
        <Link href="/" className="vf-site-logo"><span>VIBE</span><b>FUNNY</b></Link>
        {currentUser ? (
          <form action={logoutAction}><button type="submit" className="vf-topbar-action"><IconLogOut size={16} />로그아웃</button></form>
        ) : <Link href="/login" className="vf-topbar-action"><IconLogIn size={16} />로그인</Link>}
      </div>
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
        style={{ background: "rgba(6,6,6,0.88)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/" className="text-xl font-black tracking-tight">
          <span className="text-white">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-gray-400 md:flex">
          <Link href="/" className="vf-side-link"><IconHome size={18} /><span>홈</span></Link>
          <Link href="#income" className="vf-side-link"><IconBarChart size={18} /><span>수익구조</span></Link>
          <Link href="#roadmap" className="vf-side-link"><IconCalendar size={18} /><span>로드맵</span></Link>
          <Link href="#simulate" className="vf-side-link"><IconPieChart size={18} /><span>시뮬</span></Link>
          <Link href="#platforms" className="vf-side-link"><IconGlobe size={18} /><span>플랫폼</span></Link>
          <Link href="#faq" className="vf-side-link"><IconInfo size={18} /><span>FAQ</span></Link>
          <Link href="/for-advertisers" className="vf-side-link"><IconMegaphone size={18} /><span>광고주</span></Link>
        </nav>
        {currentUser && dashHref && (
          <div className="flex items-center gap-3">
            <Link href={dashHref} className="rounded-full px-4 py-2 text-xs font-bold text-black" style={{ background: "#ffc928" }}>
              마이페이지
            </Link>
          </div>
        )}
      </header>

      <MobilePublicNav myPageHref={dashHref ?? "/login"} />
      <SupportWidget isAuthenticated={Boolean(currentUser)} />

      {announcement && (
        <div className="fixed left-0 right-0 z-40 py-2 text-center text-sm font-semibold text-black" style={{ top: 64, background: "#f59e0b" }}>
          {announcement}
        </div>
      )}

      <HoneyHeroCarousel />
      {/* <FullBg
        src={BG.hero}
        overlay="linear-gradient(160deg, rgba(0,0,0,0.75) 0%, rgba(10,0,30,0.7) 100%)"
        className="pt-16"
      >
        <div className="px-6 pb-28 pt-20 md:px-16">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#f59e0b" }} />
            Side Income · Shortform · AI Video
          </div>
          <h1 className="text-[clamp(56px,10vw,132px)] font-black leading-[1.15] tracking-tight text-white">
            숏폼으로<br /><span style={{ color: "#f59e0b" }}>수익을</span><br />만들다
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            AI 영상 제작 · 숏폼 배포 · 추천 수당.<br />
            세 가지 수익 파이프라인이 동시에 작동합니다.<br />
            가입비 0원, 영상 경험 불필요, 지금 바로 시작하세요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { label: "입문 크리에이터",  val: "월 30~80만원"  },
              { label: "활발한 크리에이터", val: "월 100~200만원" },
              { label: "전업 크리에이터",  val: "월 250만원+"   },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-full px-4 py-2"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{item.label}</span>
                <span className="text-sm font-black" style={{ color: "#f59e0b" }}>{item.val}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black transition-all hover:scale-105 active:scale-95" style={{ background: "#f59e0b" }}>
              지금 바로 시작하기
            </Link>
            <Link href="#roadmap" className="text-sm font-medium transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.55)" }}>
              로드맵
            </Link>
            <a
              href="/vibefunny-guide-creator.pdf"
              download
              className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.3)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              크리에이터 소개서 PDF
            </a>
            <a
              href="/vibefunny-guide-advertiser.pdf"
              download
              className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.3)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              광고주 소개서 PDF
            </a>
          </div>
          <div className="mt-14 flex flex-wrap gap-2">
            {["AI 영상 제작", "YouTube Shorts", "Instagram Reels", "TikTok", "Facebook Reels", "추천 수당", "숏폼 배포", "부업 수익", "가입비 0원"].map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-4"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="vf-marquee">
            {Array.from({ length: 6 }).flatMap((_, i) =>
              MARQUEE_WORDS.map((w) => (
                <span key={`${i}-${w}`} className="mr-10 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {w} ·
                </span>
              ))
            )}
          </div>
        </div>
      </FullBg> */}

      <section
        id="roadmap"
        className="vf-fixed-photo-section relative overflow-hidden"
        style={{ backgroundImage: `url('${BG.roadmap}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      >
        <MobileFixedBackground src={BG.roadmap} />
        <div className="absolute inset-0 z-0" style={{ background: "rgba(2,2,8,0.90)" }} />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-16">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>Roadmap</p>
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">
              가입 후 수익이<br /><span style={{ color: "#f59e0b" }}>쌓이는 과정</span>
            </h2>
            <p className="mt-4 max-w-xl text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
              처음 가입한 날부터 안정적인 월 수익까지 — 대부분의 크리에이터가 걷는 길입니다.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-[22px] top-0 h-full w-px md:left-1/2" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="space-y-12">
              {ROADMAP_STEPS.map((step, i) => (
                <div key={step.day} className={`relative flex gap-8 ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"}`}>
                  <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-black text-xs text-black" style={{ background: step.color }}>
                    {step.day}
                  </div>
                  <div className="flex-1 rounded-2xl p-6 md:max-w-[45%]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-black text-black" style={{ background: step.color }}>{step.badge}</span>
                      <h3 className="font-black text-white">{step.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</p>
                  </div>
                  <div className="hidden flex-1 md:block" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-16 text-center">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-black text-black transition-all hover:scale-105" style={{ background: "#f59e0b" }}>
              지금 D+1을 시작하기 →
            </Link>
          </div>
        </div>
      </section>

      <FullBg src={BG.aiExpert} overlay="linear-gradient(160deg, rgba(5,0,20,0.88) 0%, rgba(0,0,0,0.83) 100%)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <SectionLabel text="AI Creator Growth" />
            <h2 className="text-4xl font-black text-white md:text-[72px] leading-[1.15]">
              AI 영상 제작<br />
              <span style={{ color: "#f59e0b" }}>전문가에 도전하세요</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              경험이 없어도 괜찮습니다. VIBEFUNNY와 함께라면 누구든 AI 영상 전문 크리에이터로 성장할 수 있습니다.
            </p>
          </div>
          <div className="mb-16 grid gap-4 md:grid-cols-4">
            {EXPERT_STEPS.map(({ Icon, step, title, desc }) => (
              <div key={step} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="mb-3" style={{ color: "#f59e0b" }}>
                  <Icon size={28} />
                </div>
                <p className="mb-1 text-xs font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>{step}</p>
                <h3 className="mb-2 font-black text-white text-base">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{desc}</p>
              </div>
            ))}
          </div>
          <div className="mb-16">
            <p className="mb-8 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>AI 크리에이터 성장 로드맵</p>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { StageIcon: IcoSprout,     stage: "입문 단계", period: "1~4주", color: "#3b82f6", items: ["AI 도구 기초 습득 (ChatGPT, Runway/Pika 영상 생성)", "첫 숏폼 영상 제작 완료", "플랫폼 계정 개설 및 첫 업로드"] },
                { StageIcon: IcoTrendingUp, stage: "성장 단계", period: "2~3개월", color: "#10b981", items: ["AI 편집 툴 활용 (CapCut AI, Descript, HeyGen)", "월 20~50개 영상 생산 루틴 완성", "첫 수익 발생 (배포 수당 + 판매 수익)"] },
                { StageIcon: IcoAward,      stage: "숙련 단계", period: "3~6개월", color: "#f59e0b", items: ["자신만의 AI 영상 스타일 확립", "추천 시스템 활용 + 팀 빌딩 시작", "월 50~150만원 수익 구조 안정화"] },
                { StageIcon: IcoCrown,      stage: "전문가 단계", period: "6개월+", color: "#ef4444", items: ["AI 영상 노하우로 강의/컨설팅 부가 수익", "광고주 캠페인 직접 수주", "월 200만원+ 멀티 수익 파이프라인"] },
              ].map((rs) => (
                <div key={rs.stage} className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="mb-2" style={{ color: rs.color }}><rs.StageIcon size={28} /></div>
                  <p className="text-xs font-black uppercase mb-0.5" style={{ color: rs.color }}>{rs.period}</p>
                  <h4 className="font-black text-white mb-3">{rs.stage}</h4>
                  <ul className="space-y-1.5">
                    {rs.items.map((ri) => (
                      <li key={ri} className="text-xs leading-relaxed flex items-start gap-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <span className="shrink-0 font-bold" style={{ color: rs.color }}>→</span><span>{ri}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-12">
            <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>AI 크리에이터 필수 도구 매트릭스</p>
            <div className="grid gap-3 md:grid-cols-5">
              {[
                { cat: "스크립트", tools: ["ChatGPT", "Claude"], color: "#8b5cf6" },
                { cat: "영상 생성", tools: ["Runway Gen-3", "Pika 2.0", "Kling AI"], color: "#ef4444" },
                { cat: "편집", tools: ["CapCut AI", "Adobe Firefly"], color: "#3b82f6" },
                { cat: "음성/아바타", tools: ["ElevenLabs", "HeyGen"], color: "#10b981" },
                { cat: "썸네일", tools: ["Midjourney", "DALL-E"], color: "#f59e0b" },
              ].map((tc) => (
                <div key={tc.cat} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <p className="text-xs font-black mb-3" style={{ color: tc.color }}>{tc.cat}</p>
                  <div className="space-y-1.5">
                    {tc.tools.map((tl) => (
                      <span key={tl} className="block rounded-lg px-2 py-1 text-xs font-medium text-center" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)" }}>{tl}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-14 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="mb-4 text-xs font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Before — 가입 전</p>
              <ul className="space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                {["영상 제작 경험 없음", "AI 도구 사용법 모름", "수익 파이프라인 없음", "부업 수단이 마땅치 않음", "시간 투자 대비 성과 불확실"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span className="text-gray-600">✕</span> {t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-8" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <p className="mb-4 text-xs font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>After — 6개월 후</p>
              <ul className="space-y-2.5 text-sm text-white">
                {["AI로 숏폼 영상 자유롭게 제작", "월 10~20편 납품으로 안정 수익", "4개 플랫폼 동시 배포 루틴 완성", "추천 네트워크로 자동화 수익 확보", "AI 영상 전문 크리에이터로 성장"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span style={{ color: "#f59e0b" }}>✓</span> {t}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mx-auto max-w-3xl rounded-2xl p-8 text-center" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-xl font-black text-white leading-snug md:text-2xl">
              "처음엔 그냥 부업이었는데,<br />
              <span style={{ color: "#f59e0b" }}>지금은 AI 영상 전문가로 불립니다."</span>
            </p>
            <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>— 박도현, 크리에이터 1년 차 · 현재 월 290만원 수익</p>
            <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-black text-black transition hover:scale-105 hover:opacity-90" style={{ background: "#f59e0b" }}>
              나도 AI 영상 전문가로 성장하기 →
            </Link>
          </div>
        </div>
      </FullBg>

      <FullBg id="income" src={BG.aiVideo} overlay="rgba(0,0,6,0.72)">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-16">
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div>
              <SectionLabel text="01 — AI Video Creation" />
              <h2 className="text-4xl font-black leading-[1.25] text-white md:text-6xl">AI 영상 제작</h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                Gemini·Veo·Sora 등 최신 AI 도구로 15~60초 숏폼 영상을 제작하고 광고주에게 직접 납품하세요.
                영상 한 편이 반복 수익으로 이어지며, 납품 즉시 수익이 지갑에 적립됩니다.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { n: "1", t: "AI 도구 접속",   d: "Gemini, Veo, Runway 등 무료·저가 AI 영상 도구 사용" },
                  { n: "2", t: "숏폼 영상 생성",  d: "프롬프트 입력 → 15~60초 광고 영상 자동 생성" },
                  { n: "3", t: "광고주에게 납품", d: "플랫폼에 업로드하면 광고주가 선택하고 결제" },
                  { n: "4", t: "수익 즉시 적립",  d: "납품 완료 확인 즉시 지갑에 단가 지급" },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-black" style={{ background: "#f59e0b" }}>{s.n}</span>
                    <div>
                      <p className="font-bold text-white text-sm">{s.t}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["AI 영상", "광고 납품", "반복 수익", "콘텐츠 제작", "무경험 OK"].map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/revenue/ai-video" className="rounded-full border px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
                  자세히 보기 →
                </Link>
                <Link href="/signup" className="rounded-full px-6 py-3 text-sm font-black text-black hover:opacity-80 transition-opacity" style={{ background: "#f59e0b" }}>
                  시작하기
                </Link>
              </div>
            </div>
            <div className="hidden text-right md:block">
              <span className="font-black text-[200px] leading-none select-none" style={{ color: "rgba(255,255,255,0.05)" }}>01</span>
            </div>
          </div>
        </div>
      </FullBg>

      <FullBg src={BG.shortform} overlay="rgba(5,0,15,0.70)">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-16">
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div className="hidden md:block">
              <span className="font-black text-[200px] leading-none select-none" style={{ color: "rgba(255,255,255,0.05)" }}>02</span>
            </div>
            <div>
              <SectionLabel text="02 — Shortform Distribution" />
              <h2 className="text-5xl font-black leading-[1.25] text-white md:text-7xl">숏폼 배포</h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                YouTube Shorts · Instagram Reels · TikTok 세 플랫폼에 동시 배포.
                배포 1건당 <strong className="text-white">고정 단가</strong>가 즉시 지급되며,
                채널 규모와 상관없이 누구나 참여할 수 있습니다.
              </p>
              <div className="mt-6 space-y-2.5">
                {[
                  { icon: "✓", text: "구독자 0명도 참여 가능 — 채널 규모 무관" },
                  { icon: "✓", text: "배포 완료 즉시 단가 적립 — 대기 없음" },
                  { icon: "✓", text: "한 번 배포한 영상은 삭제 전까지 계속 수익 발생" },
                  { icon: "✓", text: "4개 플랫폼 동시 배포로 단가 4배 효과" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span className="font-black" style={{ color: "#f59e0b" }}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["YouTube Shorts", "Instagram Reels", "TikTok", "동시 배포", "고정 단가"].map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/revenue/distribution" className="rounded-full border px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
                  자세히 보기 →
                </Link>
                <Link href="/signup" className="rounded-full px-6 py-3 text-sm font-black text-black hover:opacity-80 transition-opacity" style={{ background: "#f59e0b" }}>
                  시작하기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </FullBg>

      <FullBg src={BG.referral} overlay="rgba(0,0,0,0.72)">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-16">
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div>
              <SectionLabel text="03 — Referral Reward" />
              <h2 className="text-5xl font-black leading-[1.25] text-white md:text-7xl">추천 수당</h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                친구나 지인을 VIBEFUNNY에 초대하면 가입 즉시 <strong className="text-white">고정 수당</strong>이 지급됩니다.
                추천 인원에 제한이 없으며, 추천 네트워크가 커질수록 자동으로 수익이 쌓입니다.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["추천 링크", "즉시 지급", "무제한", "고정 수당", "자동화 수익"].map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/revenue/referral" className="rounded-full border px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
                  자세히 보기 →
                </Link>
                <Link href="/signup" className="rounded-full px-6 py-3 text-sm font-black text-black hover:opacity-80 transition-opacity" style={{ background: "#f59e0b" }}>
                  시작하기
                </Link>
              </div>
            </div>
            <div className="hidden text-right md:block">
              <span className="font-black text-[200px] leading-none select-none" style={{ color: "rgba(255,255,255,0.05)" }}>03</span>
            </div>
          </div>
        </div>
      </FullBg>

      <FullBg src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1920&q=85&fit=crop&auto=format" overlay="linear-gradient(160deg, rgba(10,0,20,0.86) 0%, rgba(0,0,0,0.82) 100%)">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-16">
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div className="hidden md:block">
              <span className="font-black text-[200px] leading-none select-none" style={{ color: "rgba(255,255,255,0.05)" }}>04</span>
            </div>
            <div>
              <SectionLabel text="04 — YouTube Shorts Commerce" />
              <h2 className="text-4xl font-black leading-[1.25] text-white md:text-6xl">유튜브 쇼츠 커머스</h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                내 유튜브 채널을 직접 운영하며 숏폼에 <strong className="text-white">상품을 연동해 판매</strong>하세요.
                관리자가 등록한 상품(카페24 연동) 중 영상과 어울리는 상품을 추천받아 쇼츠에 연결하면,
                시청자가 구매할 때마다 <strong className="text-white">판매 수수료</strong>가 수익으로 적립됩니다.
              </p>
              <div className="mt-6 space-y-2.5">
                {[
                  { icon: "✓", text: "운영용 유튜브 채널 등록 — 광고용 계정과 별개로 내 채널 운영" },
                  { icon: "✓", text: "영상 내용에 맞는 상품 자동 추천 — 링크만 넣으면 끝" },
                  { icon: "✓", text: "카페24 연동 상품으로 결제·배송까지 안정적으로 처리" },
                  { icon: "✓", text: "판매가 × 수수료율 만큼 수익 적립 — 콘텐츠가 쌓일수록 수익도 누적" },
                  { icon: "✓", text: "쇼츠 자체 수익도 — 조회수·유튜브 쇼츠 수익화로 영상 그 자체가 추가 수익원" },
                  { icon: "✓", text: "회원 간 맞구독으로 초기 구독자 확보 — 내 채널을 바로 '수익 채널'로 전환" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span className="font-black" style={{ color: "#f59e0b" }}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["내 채널 운영", "상품 연동", "카페24 연동", "판매 수수료", "쇼츠 자체 수익", "맞구독 전환", "추천 매칭"].map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/revenue/shorts-commerce" className="rounded-full border px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
                  자세히 보기 →
                </Link>
                <Link href="/signup" className="rounded-full px-6 py-3 text-sm font-black text-black hover:opacity-80 transition-opacity" style={{ background: "#f59e0b" }}>
                  시작하기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </FullBg>



      <section
        className="vf-fixed-photo-section relative overflow-hidden"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&q=85&fit=crop&auto=format')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      >
        <MobileFixedBackground src="https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&q=85&fit=crop&auto=format" />
        <div className="absolute inset-0 z-0" style={{ background: "rgba(2,2,12,0.88)" }} />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>Distribution Strategy</p>
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">
              AI 영상 배포 마케팅<br />
              <span style={{ color: "#f59e0b" }}>1개 영상으로 4개 플랫폼 동시 공략</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              하나의 AI 영상을 YouTube Shorts, Instagram Reels, TikTok, Facebook Reels에 동시 배포하면
              알고리즘 노출이 4배, 수익 채널이 4배가 됩니다.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-14">
            {[
              { platform: "YouTube Shorts", color: "#FF0000", Brand: BrandYouTube, headline: "채널당 추가 수익원", tips: ["배포 1건당 고정 단가 즉시 지급", "조회수가 오를수록 누적 수익 증가", "구독자 0명도 바로 수익화 가능", "한 번 올린 영상이 계속 수익 발생"] },
              { platform: "Instagram Reels", color: "#C13584", Brand: BrandInstagram, headline: "수익 채널 2배 확대", tips: ["같은 영상으로 추가 배포 단가 획득", "팔로워가 늘수록 제휴·협찬 수익 기회", "스토리 연동으로 노출·수익 동시 확대", "브랜드 캠페인 우선 매칭 기회"] },
              { platform: "TikTok", color: "#00F2EA", Brand: BrandTikTok, headline: "바이럴로 수익 극대화", tips: ["신규 채널도 즉시 배포 수익화", "바이럴 시 추가 보상으로 수익 폭발", "배포 건당 즉시 정산", "챌린지 참여로 보너스 수익 확보"] },
              { platform: "Facebook Reels", color: "#1877F2", Brand: BrandFacebook, headline: "도달 최대 = 수익 최대", tips: ["30억 이용자 도달로 수익 기회 최대", "전 연령 타겟으로 안정적 배포 수익", "같은 영상 추가 배포로 단가 누적", "메타 광고 연동 시 수익 추가 확대"] },
            ].map((dp) => (
              <div key={dp.platform} className="vf-hover rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="mb-3"><dp.Brand size={44} /></div>
                <h3 className="text-lg font-black text-white mb-0.5">{dp.platform}</h3>
                <p className="text-xs font-bold mb-4" style={{ color: dp.color }}>{dp.headline}</p>
                <ul className="space-y-2">
                  {dp.tips.map((tip) => (
                    <li key={tip} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      <span className="font-black shrink-0" style={{ color: dp.color }}>₩</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2 mb-14">
            <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <h3 className="text-xl font-black text-white mb-5">배포 효율화 전략</h3>
              <div className="space-y-4">
                {[
                  { Icon: IcoLnSubtitle, title: "AI 자동 자막", desc: "3개국어 버전 동시 생성으로 글로벌 노출 극대화" },
                  { Icon: IcoLnClock, title: "예약 발행 시스템", desc: "최적 시간대 자동 배포로 알고리즘 타이밍 포착" },
                  { Icon: IcoLnChart, title: "데이터 기반 학습", desc: "분석 데이터로 알고리즘 선호 콘텐츠 패턴 파악" },
                ].map((ef) => (
                  <div key={ef.title} className="flex gap-3 items-start">
                    <span className="shrink-0" style={{ color: "#f59e0b" }}><ef.Icon size={24} /></span>
                    <div>
                      <p className="font-bold text-white text-sm">{ef.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{ef.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-8" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <h3 className="text-xl font-black text-white mb-2">VIBEFUNNY 자동 배포 시스템</h3>
              <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>크리에이터는 제작에만 집중, 나머지는 플랫폼이 처리</p>
              <div className="space-y-3">
                {[
                  { num: "1", text: "영상 1회 등록", desc: "VIBEFUNNY에 영상 한 번만 업로드" },
                  { num: "2", text: "플랫폼별 최적화", desc: "각 플랫폼 규격에 맞게 자동 변환" },
                  { num: "3", text: "자동 일정 배포", desc: "최적 시간대에 4개 플랫폼 동시 발행" },
                ].map((sv) => (
                  <div key={sv.num} className="flex gap-3 items-start rounded-xl p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-black" style={{ background: "#f59e0b" }}>{sv.num}</span>
                    <div>
                      <p className="font-bold text-white text-sm">{sv.text}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{sv.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 mb-10">
            <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="mb-4 text-xs font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>기존 배포 방식</p>
              <ul className="space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                {["영상 제작 1~3일 소요", "플랫폼별 개별 편집·업로드 필요", "자막 수동 작성", "배포 시간 수동 관리", "단일 플랫폼 수익만 발생"].map((bt) => (
                  <li key={bt} className="flex items-center gap-2"><span style={{ color: "rgba(255,255,255,0.25)" }}>✕</span>{bt}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-7" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <p className="mb-4 text-xs font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>AI 자동화 배포 방식</p>
              <ul className="space-y-2 text-sm text-white">
                {["AI로 영상 제작 30분~1시간", "1회 등록 후 4플랫폼 자동 배포", "AI 자동 자막 + 다국어 지원", "최적 시간대 자동 스케줄링", "4개 플랫폼 수익 동시 발생"].map((at) => (
                  <li key={at} className="flex items-center gap-2"><span style={{ color: "#f59e0b" }}>✓</span>{at}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="text-center">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-black text-black transition-all hover:scale-105" style={{ background: "#f59e0b" }}>
              지금 4개 플랫폼 동시 배포 시작하기 →
            </Link>
          </div>
        </div>
      </section>

      <section
        id="simulate"
        className="vf-fixed-photo-section relative overflow-hidden"
        style={{ backgroundImage: `url('${BG.income}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      >
        <MobileFixedBackground src={BG.income} />
        <div className="absolute inset-0 z-0" style={{ background: "rgba(0,0,0,0.88)" }} />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>Income Simulation</p>
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">월 수익 시뮬레이션</h2>
            <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
              활동 수준에 따른 예상 수익 범위입니다.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {INCOME_TIERS.map((tier) => (
              <div
                key={tier.tier}
                className="relative rounded-2xl p-7"
                style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full px-4 py-1 text-xs font-black text-black" style={{ background: tier.color }}>MOST POPULAR</span>
                  </div>
                )}
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: tier.color }}>{tier.tier}</p>
                <h3 className="text-lg font-extrabold text-white mb-1">{tier.label}</h3>
                <p className="text-3xl font-black mb-1" style={{ color: tier.color }}>{tier.monthly}</p>
                <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>{tier.desc}</p>
                <div className="space-y-2.5">
                  {tier.items.map((item) => (
                    <div key={item.act} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-white">{item.act}</span>
                        <span className="font-bold" style={{ color: tier.color }}>{item.earn}</span>
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{item.val}</p>
                    </div>
                  ))}
                </div>
                <Link href="/signup" className="mt-6 flex w-full items-center justify-center rounded-xl py-3 text-sm font-black text-black transition hover:opacity-90" style={{ background: tier.color }}>
                  이 수준으로 시작하기 →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FullBg src={BG.stats} overlay="rgba(0,0,0,0.82)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-14">
            <SectionLabel text="Numbers" />
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">
              숫자로 보는<br /><span style={{ color: "#f59e0b" }}>VIBEFUNNY</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.key} className="border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <div className="text-4xl font-black text-white md:text-5xl">{s.value}<span className="text-2xl">{s.suffix}</span></div>
                <div className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pb-24">
          <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>글로벌 AI 영상 시장 핵심 지표</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-14">
            {[
              { Icon: IcoTrendingUp, label: "AI 영상 시장 2030년 전망", value: "21조원+", sub: "2023년 2.8조원 CAGR 35%+" },
              { Icon: IcoLnPhone, label: "숏폼 동영상 시장 (2024)", value: "120조원", sub: "연간 25% 성장 지속 중" },
              { Icon: IcoLnTrendDown, label: "AI 영상 제작 비용 절감", value: "90%↓", sub: "기존 영상 제작비 대비" },
              { Icon: IcoLnPlay, label: "YouTube Shorts 월 재생", value: "500억회+", sub: "크리에이터 $500M+ 배분 (2023)" },
              { Icon: IcoLnCamera, label: "Instagram Reels MAU", value: "20억명", sub: "전 포맷 중 광고 단가 최고" },
              { Icon: IcoLnMusic, label: "TikTok 하루 평균 시청", value: "95분", sub: "Z세대 검색 플랫폼 1위" },
              { Icon: IcoLnFacebook, label: "Facebook Reels MAU", value: "30억명", sub: "세계 최대 SNS · 전 연령 도달" },
              { Icon: IcoLnGlobe, label: "4대 플랫폼 합산 MAU", value: "80억+", sub: "단일 영상으로 전 세계 도달" },
            ].map((mi) => (
              <div key={mi.label} className="rounded-2xl p-5 text-center vf-hover" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="mb-3 flex justify-center" style={{ color: "#f59e0b" }}><mi.Icon size={30} /></div>
                <div className="text-2xl font-black text-white mb-1">{mi.value}</div>
                <div className="text-xs font-bold mb-1" style={{ color: "#f59e0b" }}>{mi.label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{mi.sub}</div>
              </div>
            ))}
          </div>
          <div className="mx-auto max-w-3xl rounded-2xl p-8" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <h3 className="text-2xl font-black text-white mb-4">왜 지금 AI 영상 시장인가?</h3>
            <p className="text-base leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
              5년 내 모든 디지털 광고의{" "}
              <strong className="text-white">80%가 영상 형태로 전환</strong>될 것으로 예측됩니다.
              AI 도구가 일반화되면서 영상 제작 진입장벽은 사라졌고,
              이제는{" "}<strong className="text-white">누가 빠르게 배우고 꾸준히 만드느냐</strong>가 수익의 차이를 만듭니다.
            </p>
            <div className="flex flex-wrap gap-3">
              {["디지털 광고의 80% 영상 전환", "AI 도구로 진입장벽 소멸", "숏폼 = 가장 빠른 수익화 포맷", "지금이 선점 타이밍"].map((wt) => (
                <span key={wt} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>{wt}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-5" style={{ background: "#f59e0b" }}>
          <div className="vf-marquee-slow">
            {Array.from({ length: 8 }).flatMap((_, i) =>
              ["숏폼 배포 수익", "AI 영상 납품", "추천 수당", "SHORTFORM INCOME", "CREATOR PLATFORM", "부업 수익", "월 수백만원"].map((t) => (
                <span key={`${i}-${t}`} className="mr-10 whitespace-nowrap text-sm font-black uppercase tracking-widest text-black">{t} ·</span>
              ))
            )}
          </div>
        </div>
      </FullBg>

      <FullBg id="platforms" src={BG.platforms} overlay="rgba(0,0,0,0.78)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-14">
            <SectionLabel text="Platform" />
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">4개 플랫폼에<br />동시 배포</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLATFORMS.map((p) => (
              <div key={p.name} className="vf-hover rounded-2xl p-8"
                style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="mb-4"><p.Brand size={52} /></div>
                <h3 className="text-xl font-black text-white">{p.name}</h3>
                <p className="mt-1 text-3xl font-black text-white">{p.users}</p>
                <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{p.desc}</p>
                <p className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>{p.earn}</p>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      <FullBg src={BG.testimonials} overlay="rgba(0,0,0,0.80)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-14">
            <SectionLabel text="Voice" />
            <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">실제 크리에이터<br />수익 후기</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="vf-hover rounded-2xl p-8"
                style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>현재 수익</span>
                  <span className="text-sm font-black" style={{ color: "#f59e0b" }}>{t.income}</span>
                </div>
                <p className="mb-4 text-5xl font-serif leading-none" style={{ color: "rgba(245,158,11,0.5)" }}>&#8220;</p>
                <p className="mb-8 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{t.quote}</p>
                <div className="border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <p className="font-bold text-white">{t.name}</p>
                  <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      <FullBg src={BG.advertiser} overlay="linear-gradient(135deg, rgba(15,5,40,0.88) 0%, rgba(0,0,0,0.85) 100%)">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center md:px-16">
          <SectionLabel text="For Advertisers" />
          <h2 className="text-5xl font-black text-white md:text-[72px] leading-[1.2]">광고주이신가요?</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            실행사 · 대행사 전용 페이지에서 숏폼 광고 캠페인을 시작하세요.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/for-advertisers" className="rounded-full px-8 py-4 text-base font-black text-black transition-all hover:opacity-90 hover:scale-105" style={{ background: "#f59e0b" }}>
              광고주 전용 페이지 →
            </Link>
          </div>
        </div>
      </FullBg>

      <FullBg id="faq" src={BG.faq} overlay="rgba(250,250,250,0.94)">
        <div className="mx-auto max-w-3xl px-6 py-24 md:px-16">
          <div className="mb-14">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">FAQ</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl">자주 묻는 질문</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="vf-faq overflow-hidden rounded-xl border border-gray-200 bg-white/80" style={{ backdropFilter: "blur(8px)" }}>
                <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5 font-bold text-gray-900 transition-colors hover:bg-gray-50">
                  <span>{faq.q}</span>
                  <span className="vf-plus ml-4 shrink-0 text-2xl font-light text-gray-400">+</span>
                </summary>
                <div className="border-t border-gray-100 px-6 py-5 text-sm leading-relaxed text-gray-600">{faq.a}</div>
              </details>
            ))}
          </div>
          <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: "#fefce8", border: "1px solid #fde68a" }}>
            <p className="font-black text-gray-900 text-lg">아직 궁금한 게 있으신가요?</p>
            <Link href="/signup" className="mt-4 inline-block rounded-full px-6 py-3 text-sm font-black text-black transition hover:opacity-80" style={{ background: "#f59e0b" }}>
              무료 가입하고 문의하기 →
            </Link>
          </div>
        </div>
      </FullBg>

      <section className="relative overflow-hidden py-28 text-center" style={{
        backgroundImage: `url('${BG.cta}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}>
        <div className="absolute inset-0 z-0" style={{ background: "rgba(2,4,12,0.90)" }} />
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center opacity-5">
          <span className="text-[400px] font-black leading-none text-white select-none">&#8361;</span>
        </div>
        <div className="relative z-10 mx-auto max-w-2xl px-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>지금 시작하세요</p>
          <h2 className="text-4xl font-black text-white md:text-6xl leading-[1.25]">
            오늘이<br /><span style={{ color: "#f59e0b" }}>수익 D+1</span>이<br />됩니다
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            가입비 0원 · 영상 경험 불필요 · 오늘 가입하면 이번 달 안에 첫 수익.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="rounded-full px-10 py-4 text-lg font-black text-black transition-all hover:scale-105 active:scale-95" style={{ background: "#f59e0b" }}>
              무료로 크리에이터 시작하기
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t px-6 py-12 md:px-12" style={{ background: "#060606", borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-white">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-gray-500">숏폼 크리에이터·광고주 플랫폼 · 가입비 0원 · 4대 플랫폼 동시 배포</p>
          </div>
          <div className="flex gap-12 text-sm text-gray-500">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600">크리에이터</p>
              <div className="space-y-2">
                <div><Link href="/signup"               className="hover:text-white transition-colors">크리에이터 가입</Link></div>
                <div><Link href="/revenue/ai-video"     className="hover:text-white transition-colors">AI 영상 수익</Link></div>
                <div><Link href="/revenue/distribution" className="hover:text-white transition-colors">배포 수익</Link></div>
                <div><Link href="/revenue/referral"     className="hover:text-white transition-colors">추천 수익</Link></div>
                <div><Link href="/revenue/shorts-commerce" className="hover:text-white transition-colors">쇼츠 커머스 수익</Link></div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600">광고주</p>
              <div className="space-y-2">
                <div><Link href="/for-advertisers"         className="hover:text-white transition-colors">광고주 소개</Link></div>
                <div><Link href="/signup?role=advertiser"  className="hover:text-white transition-colors">광고주 가입</Link></div>
                <div><Link href="/login"                   className="hover:text-white transition-colors">로그인</Link></div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t pt-8" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-600">&#169; 2025 VIBEFUNNY. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/vibefunny-guide-creator.pdf" download className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition-colors hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                크리에이터 소개서
              </a>
              <a href="/vibefunny-guide-advertiser.pdf" download className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition-colors hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                광고주 소개서
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
