import Link from "next/link";

export const metadata = {
  title: "AI 영상 제작 수익 | VIBEFUNNY",
  description: "AI 도구로 숏폼 광고 영상을 제작하고 광고주에게 직접 납품해 수익을 만드세요.",
};

const BG = {
  hero:    "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=85&fit=crop&auto=format",
  process: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1920&q=85&fit=crop&auto=format",
  tools:   "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=85&fit=crop&auto=format",
  income:  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85&fit=crop&auto=format",
};

const STEPS = [
  {
    n: "01",
    title: "브리프 확인",
    desc: "광고주가 등록한 캠페인 브리프(제품명·톤·길이)를 확인합니다. 별도 미팅 없이 플랫폼에서 바로 확인 가능합니다.",
  },
  {
    n: "02",
    title: "AI 영상 제작",
    desc: "Gemini, Veo, Pika 등의 AI 툴로 15~60초 숏폼 영상을 제작합니다. 촬영 장비나 편집 경험이 없어도 됩니다.",
  },
  {
    n: "03",
    title: "영상 업로드·납품",
    desc: "완성된 영상을 플랫폼에 업로드하고 광고주에게 납품합니다. 광고주가 승인하면 수익이 즉시 적립됩니다.",
  },
  {
    n: "04",
    title: "수익 출금",
    desc: "지갑에 쌓인 수익을 언제든 출금 신청할 수 있습니다. 정산 처리는 평균 1~3 영업일 내에 완료됩니다.",
  },
];

const TOOLS = [
  { name: "Google Veo 3", desc: "텍스트 → 고품질 영상 생성", tag: "영상 생성 AI" },
  { name: "Gemini 1.5 Pro", desc: "스크립트·카피 자동 작성", tag: "텍스트 AI" },
  { name: "Pika Labs", desc: "이미지/영상 모션 생성", tag: "모션 AI" },
  { name: "CapCut AI", desc: "자동 자막·편집·효과", tag: "편집 AI" },
  { name: "Adobe Firefly", desc: "AI 기반 이미지·그래픽", tag: "이미지 AI" },
  { name: "ElevenLabs", desc: "AI 보이스오버 생성", tag: "음성 AI" },
];

const INCOME_TABLE = [
  { type: "15초 이하", min: "15,000", max: "30,000", note: "가장 수요 多" },
  { type: "30초 이하", min: "25,000", max: "50,000", note: "배포용 표준" },
  { type: "60초 이하", min: "40,000", max: "80,000", note: "브랜드 스토리" },
  { type: "직접 협의", min: "80,000", max: "-", note: "특수 포맷" },
];

function FullBg({
  src,
  overlay = "rgba(0,0,0,0.72)",
  children,
  className = "",
  id,
}: {
  src: string;
  overlay?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
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

export default function AiVideoRevenuePage() {
  return (
    <div className="vf-marketing vf-revenue-detail">
      <style>{`
        @keyframes rv-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .rv-marquee { display:flex; width:max-content; animation: rv-marquee 35s linear infinite; }
      `}</style>

      {/* NAV */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
        style={{ background: "rgba(6,6,6,0.90)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/" className="vf-site-logo text-xl font-black tracking-tight">
          <span className="text-white">VIBE</span>
          <span style={{ color: "#f59e0b" }}>FUNNY</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/#income" className="hidden text-sm font-medium text-gray-400 transition hover:text-white md:block">← 수익 구조</Link>
          <Link href="/signup" className="rounded-full px-5 py-2 text-sm font-bold text-black" style={{ background: "#f59e0b" }}>무료 시작하기</Link>
        </div>
      </header>

      {/* HERO */}
      <FullBg src={BG.hero} overlay="linear-gradient(160deg, rgba(0,0,0,0.80) 0%, rgba(5,0,25,0.75) 100%)" className="pt-16">
        <div className="px-6 pb-24 pt-20 md:px-16">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            Revenue 01 · AI Video Creation
          </div>
          <h1 className="text-[clamp(44px,9vw,112px)] font-black leading-[1.12] tracking-tight text-white">
            AI로 만들고<br />
            <span style={{ color: "#f59e0b" }}>광고주에게</span><br />
            납품하다
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            카메라 없이, 편집 경험 없이. AI 도구 하나로 완성된 숏폼 광고 영상을 만들고
            플랫폼에 등록된 광고주에게 직접 납품해 수익을 창출하세요.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              { v: "₩0", l: "장비 투자 비용" },
              { v: "24만+", l: "월 평균 납품 수익" },
              { v: "1~3일", l: "평균 제작 소요 시간" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border p-4 text-center" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="text-xl font-black" style={{ color: "#f59e0b" }}>{s.v}</div>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:opacity-90 transition-all hover:scale-105" style={{ background: "#f59e0b" }}>
              지금 크리에이터로 가입
            </Link>
            <Link href="#process" className="rounded-full border px-8 py-4 text-base font-medium text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              제작 프로세스 보기
            </Link>
          </div>
        </div>
        {/* marquee */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-4" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
          <div className="rv-marquee">
            {Array.from({ length: 8 }).flatMap((_, i) =>
              ["AI 영상 제작", "광고 납품", "Gemini·Veo", "숏폼 크리에이터", "NO EQUIPMENT", "즉시 수익"].map((w) => (
                <span key={`${i}-${w}`} className="mr-10 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{w} ·</span>
              ))
            )}
          </div>
        </div>
      </FullBg>

      {/* PROCESS */}
      <section id="process" className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">How It Works</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl">4단계로 수익 발생</h2>
            <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
              복잡한 과정 없이 브리프 확인 → 제작 → 납품 → 출금까지 플랫폼 안에서 모두 완료됩니다.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
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

      {/* AI TOOLS */}
      <FullBg src={BG.tools} overlay="rgba(0,0,0,0.82)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>AI Tools</p>
            <h2 className="text-4xl font-black text-white md:text-5xl leading-[1.25]">
              이 도구들로<br />영상을 만듭니다
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
              모두 무료 플랜으로 시작할 수 있습니다. 추가 학습 자료는 대시보드에서 제공됩니다.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <div key={t.name} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                  {t.tag}
                </span>
                <h3 className="mt-3 text-lg font-black text-white">{t.name}</h3>
                <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      {/* INCOME TABLE */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#0a0a0a" }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-600">Pricing</p>
            <h2 className="text-4xl font-black text-white md:text-5xl">예상 납품 단가</h2>
            <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
              영상 길이와 퀄리티에 따라 단가가 결정됩니다. 아래는 참고용 범위입니다.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="grid grid-cols-4 px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span>영상 타입</span>
              <span className="text-center">최소 단가</span>
              <span className="text-center">최대 단가</span>
              <span className="text-right">비고</span>
            </div>
            {INCOME_TABLE.map((row, i) => (
              <div
                key={row.type}
                className="grid grid-cols-4 px-6 py-4 text-sm"
                style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent", borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span className="font-bold text-white">{row.type}</span>
                <span className="text-center font-medium" style={{ color: "#f59e0b" }}>₩{row.min}</span>
                <span className="text-center font-medium text-white">{row.max !== "-" ? `₩${row.max}` : "-"}</span>
                <span className="text-right text-gray-500">{row.note}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-center text-gray-600">* 실제 단가는 광고주 설정 및 캠페인 조건에 따라 달라질 수 있습니다.</p>
        </div>
      </section>

      {/* CTA */}
      <FullBg src={BG.income} overlay="rgba(0,0,0,0.70)">
        <div className="mx-auto max-w-3xl px-6 py-28 text-center md:px-16">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Start Now</p>
          <h2 className="text-[clamp(44px,8vw,88px)] font-black leading-[1.12] text-white">
            지금 바로<br /><span style={{ color: "#f59e0b" }}>AI 제작</span><br />시작하기
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
            가입비 0원 · AI 제작 가이드 제공 · 즉시 캠페인 참여 가능
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 transition-all" style={{ background: "#f59e0b" }}>
              크리에이터로 무료 가입 →
            </Link>
            <Link href="/#income" className="rounded-full border px-8 py-4 text-base font-medium text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              다른 수익 구조 보기
            </Link>
          </div>
        </div>
      </FullBg>

      {/* FOOTER */}
      <footer className="border-t px-6 py-8 md:px-12" style={{ background: "#060606", borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="vf-site-logo text-sm font-black">
            <span className="text-white">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <Link href="/revenue/distribution" className="hover:text-white transition-colors">숏폼 배포</Link>
            <Link href="/revenue/referral" className="hover:text-white transition-colors">추천 수당</Link>
            <Link href="/signup" className="hover:text-white transition-colors">가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
