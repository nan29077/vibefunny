import Link from "next/link";

export const metadata = {
  title: "숏폼 배포 수익 | VIBEFUNNY",
  description: "YouTube Shorts·Instagram Reels·TikTok·Facebook Reels에 광고 숏폼을 배포하고 건당 고정 수익을 받으세요.",
};

const BG = {
  hero:      "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=1920&q=85&fit=crop&auto=format",
  platforms: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&q=85&fit=crop&auto=format",
  how:       "https://images.unsplash.com/photo-1551135049-8a33b5883817?w=1920&q=85&fit=crop&auto=format",
  income:    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85&fit=crop&auto=format",
};

const PLATFORMS = [
  {
    name: "YouTube Shorts",
    color: "#FF0000",
    bgColor: "rgba(255,0,0,0.1)",
    icon: "▶",
    users: "20억+",
    desc: "세계 최대 동영상 플랫폼. 60초 이하 숏폼으로 급성장 중인 섹션입니다.",
    tips: ["채널 구독자 제한 없음", "영상 60초 이하", "유튜브 계정 필요"],
  },
  {
    name: "Instagram Reels",
    color: "#C13584",
    bgColor: "rgba(193,53,132,0.1)",
    icon: "◈",
    users: "20억+",
    desc: "글로벌 SNS 1위. 릴스 알고리즘이 팔로워 외 사용자에게도 노출합니다.",
    tips: ["팔로워 수 무관", "영상 90초 이하", "인스타그램 계정 필요"],
  },
  {
    name: "TikTok",
    color: "#69C9D0",
    bgColor: "rgba(105,201,208,0.1)",
    icon: "♪",
    users: "10억+",
    desc: "Z세대 숏폼 1위. 신규 계정도 바이럴 가능성이 높은 플랫폼입니다.",
    tips: ["팔로워 수 무관", "영상 180초 이하", "틱톡 계정 필요"],
  },
  {
    name: "Facebook Reels",
    color: "#1877F2",
    bgColor: "rgba(24,119,242,0.1)",
    icon: "f",
    users: "30억+",
    desc: "세계 최대 SNS 플랫폼. 전 연령대에 걸친 광범위한 도달률이 강점입니다.",
    tips: ["팔로워 수 무관", "영상 60초 이하", "Facebook 계정 필요"],
  },
];

const STEPS = [
  { n: "01", title: "소셜 채널 연결", desc: "VIBEFUNNY 대시보드에서 YouTube·Instagram·TikTok·Facebook 채널 URL을 등록하고 간단한 인증을 완료합니다." },
  { n: "02", title: "캠페인 참여 신청", desc: "참여하고 싶은 광고 캠페인을 선택해 신청합니다. 카테고리·플랫폼·단가를 확인하고 결정하세요." },
  { n: "03", title: "영상 다운로드 & 업로드", desc: "승인된 광고 영상을 다운로드해 본인 채널에 업로드합니다. 업로드 URL을 제출하면 완료입니다." },
  { n: "04", title: "수익 자동 적립", desc: "검증이 완료되면 건당 고정 단가가 지갑에 즉시 적립됩니다. 출금은 언제든 신청 가능합니다." },
];

const INCOME_TABLE = [
  { platform: "YouTube Shorts", unit: "1회 배포", min: "2,000", max: "8,000", note: "채널 규모에 따라 상이" },
  { platform: "Instagram Reels", unit: "1회 배포", min: "2,000", max: "8,000", note: "릴스 커버리지 기준" },
  { platform: "TikTok", unit: "1회 배포", min: "2,000", max: "6,000", note: "국내 계정 기준" },
  { platform: "Facebook Reels", unit: "1회 배포", min: "2,000", max: "7,000", note: "메타 플랫폼 기준" },
  { platform: "4개 동시 배포", unit: "1세트", min: "8,000", max: "29,000", note: "세트 할인 적용" },
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
      style={{ backgroundImage: `url('${src}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <div className="absolute inset-0 z-0" style={{ background: overlay }} />
      <div className="relative z-10 w-full">{children}</div>
    </section>
  );
}

export default function DistributionRevenuePage() {
  return (
    <>
      <style>{`
        @keyframes dist-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .dist-marquee { display:flex; width:max-content; animation: dist-marquee 35s linear infinite; }
        .dist-card { transition: transform .25s ease, box-shadow .25s ease; }
        .dist-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,.4); }
      `}</style>

      {/* NAV */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
        style={{ background: "rgba(6,6,6,0.90)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/" className="text-xl font-black">
          <span className="text-white">VIBE</span>
          <span style={{ color: "#f59e0b" }}>FUNNY</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/#income" className="hidden text-sm text-gray-400 transition hover:text-white md:block">← 수익 구조</Link>
          <Link href="/signup" className="rounded-full px-5 py-2 text-sm font-bold text-black" style={{ background: "#f59e0b" }}>무료 시작하기</Link>
        </div>
      </header>

      {/* HERO */}
      <FullBg src={BG.hero} overlay="linear-gradient(160deg, rgba(5,0,20,0.85) 0%, rgba(0,0,0,0.75) 100%)" className="pt-16">
        <div className="px-6 pb-24 pt-20 md:px-16">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            Revenue 02 · Shortform Distribution
          </div>
          <h1 className="text-[clamp(44px,9vw,112px)] font-black leading-[1.12] tracking-tight text-white">
            올리기만 해도<br />
            <span style={{ color: "#f59e0b" }}>매달 수익이</span><br />
            들어온다
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            내 채널에 광고 숏폼을 업로드하면 건당 고정 수익이 지급됩니다.
            구독자 수·팔로워 수 조건 없이 누구나 참여할 수 있습니다.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              { v: "4개", l: "배포 가능 플랫폼" },
              { v: "80억+", l: "4대 플랫폼 월 사용자" },
              { v: "즉시", l: "검증 완료 후 수익 적립" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border p-4 text-center" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="text-xl font-black" style={{ color: "#f59e0b" }}>{s.v}</div>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 hover:opacity-90 transition-all" style={{ background: "#f59e0b" }}>
              지금 배포자로 가입
            </Link>
            <Link href="#platforms" className="rounded-full border px-8 py-4 text-base font-medium text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              플랫폼 보기
            </Link>
          </div>
        </div>
        {/* marquee */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-4" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="dist-marquee">
            {Array.from({ length: 8 }).flatMap((_, i) =>
              ["숏폼 배포", "YouTube Shorts", "Instagram Reels", "TikTok", "Facebook Reels", "건당 고정 수익", "무구독자 참여 가능"].map((w) => (
                <span key={`${i}-${w}`} className="mr-10 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{w} ·</span>
              ))
            )}
          </div>
        </div>
      </FullBg>

      {/* PLATFORMS */}
      <section id="platforms" className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Platforms</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl leading-[1.25]">
              4개 플랫폼에<br />동시 배포
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
              하나의 캠페인으로 네 플랫폼에 동시 배포하면 최대 수익을 올릴 수 있습니다.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLATFORMS.map((p) => (
              <div key={p.name} className="dist-card rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-black" style={{ background: p.bgColor, color: p.color }}>
                  {p.icon}
                </div>
                <h3 className="text-xl font-black text-gray-900">{p.name}</h3>
                <p className="mt-1 text-2xl font-black" style={{ color: p.color }}>{p.users}</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{p.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {p.tips.map((tip) => (
                    <li key={tip} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <FullBg src={BG.how} overlay="rgba(0,0,0,0.82)">
        <div className="mx-auto max-w-5xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Process</p>
            <h2 className="text-4xl font-black text-white md:text-5xl leading-[1.25]">
              4단계로 수익 발생
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-black" style={{ background: "#f59e0b" }}>
                  {s.n}
                </div>
                <h3 className="font-black text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-[1.7]" style={{ color: "rgba(255,255,255,0.55)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      {/* INCOME TABLE */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#0a0a0a" }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-600">Earnings</p>
            <h2 className="text-4xl font-black text-white md:text-5xl">예상 배포 수익</h2>
            <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
              플랫폼별·캠페인별로 단가가 다릅니다. 아래는 참고용 범위입니다.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="grid grid-cols-4 px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span>배포 방식</span>
              <span className="text-center">단위</span>
              <span className="text-center">최소</span>
              <span className="text-right">최대</span>
            </div>
            {INCOME_TABLE.map((row, i) => (
              <div
                key={row.platform}
                className="grid grid-cols-4 px-6 py-4 text-sm"
                style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent", borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span className="font-bold text-white">{row.platform}</span>
                <span className="text-center text-gray-400">{row.unit}</span>
                <span className="text-center font-medium" style={{ color: "#f59e0b" }}>₩{row.min}</span>
                <span className="text-right font-medium text-white">₩{row.max}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-center text-gray-600">* 실제 단가는 광고주 캠페인 설정에 따라 달라질 수 있습니다.</p>
        </div>
      </section>

      {/* CTA */}
      <FullBg src={BG.income} overlay="rgba(0,0,0,0.70)">
        <div className="mx-auto max-w-3xl px-6 py-28 text-center md:px-16">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Start Now</p>
          <h2 className="text-[clamp(44px,8vw,88px)] font-black leading-[1.12] text-white">
            내 채널이<br /><span style={{ color: "#f59e0b" }}>수익 파이프라인</span><br />이 됩니다
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
            구독자 수 무관 · 가입비 0원 · 건당 고정 수익
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 transition-all" style={{ background: "#f59e0b" }}>
              지금 배포자로 가입 →
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
          <div className="text-sm font-black">
            <span className="text-white">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <Link href="/revenue/ai-video" className="hover:text-white transition-colors">AI 영상 제작</Link>
            <Link href="/revenue/referral" className="hover:text-white transition-colors">추천 수당</Link>
            <Link href="/signup" className="hover:text-white transition-colors">가입</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
