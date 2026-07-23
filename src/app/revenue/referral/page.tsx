import Link from "next/link";

export const metadata = {
  title: "추천 수당 수익 | VIBEFUNNY",
  description: "친구를 VIBEFUNNY에 초대하고 가입 즉시 고정 수당을 받으세요. 추천 인원에 제한이 없습니다.",
};

const BG = {
  hero:    "https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=1920&q=85&fit=crop&auto=format",
  how:     "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1920&q=85&fit=crop&auto=format",
  income:  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85&fit=crop&auto=format",
};

const STEPS = [
  { n: "01", title: "가입 완료", desc: "VIBEFUNNY 크리에이터로 가입하면 즉시 본인만의 추천 코드와 추천 링크가 생성됩니다." },
  { n: "02", title: "링크 공유", desc: "SNS·카카오톡·이메일 등 어디서든 추천 링크를 공유하세요. 링크 클릭 시 추천 코드가 자동 적용됩니다." },
  { n: "03", title: "친구 가입", desc: "공유한 링크로 친구가 회원가입을 완료하면 추천 관계가 자동으로 등록됩니다." },
  { n: "04", title: "수당 즉시 지급", desc: "가입 완료 즉시 고정 수당이 지갑에 적립됩니다. 추천 인원 제한 없이 계속 쌓입니다." },
];

const FAQ = [
  { q: "추천 수당은 얼마인가요?", a: "추천 1건당 고정 수당이 지급됩니다. 정확한 금액은 관리자 설정에 따라 달라지며, 대시보드 '추천인 제도' 메뉴에서 확인할 수 있습니다." },
  { q: "추천 인원 제한이 있나요?", a: "없습니다. 무제한으로 추천할 수 있으며, 추천한 인원만큼 수당이 누적됩니다." },
  { q: "추천 코드는 어떻게 받나요?", a: "VIBEFUNNY 크리에이터로 가입하면 즉시 본인만의 추천 코드가 생성됩니다. 별도 신청 없이 대시보드에서 바로 확인할 수 있습니다." },
  { q: "수당은 언제 지급되나요?", a: "추천인이 가입을 완료하는 즉시 지갑에 적립됩니다. 별도 대기 시간이 없습니다." },
  { q: "수당 출금은 어떻게 하나요?", a: "지갑에 적립된 수당은 최소 출금 금액 이상이 쌓이면 언제든 출금 신청이 가능합니다. 심사 후 1~3영업일 내 계좌로 입금됩니다." },
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

export default function ReferralRevenuePage() {
  return (
    <div className="vf-marketing vf-revenue-detail">
      <style>{`
        @keyframes ref-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .ref-marquee { display:flex; width:max-content; animation: ref-marquee 35s linear infinite; }
        details.ref-faq > summary { list-style:none; }
        details.ref-faq > summary::-webkit-details-marker { display:none; }
        .ref-plus { transition:transform .2s ease; display:inline-block; }
        details[open] .ref-plus { transform:rotate(45deg); }
      `}</style>

      {/* NAV */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
        style={{ background: "rgba(6,6,6,0.90)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/" className="vf-site-logo text-xl font-black">
          <span className="text-white">VIBE</span>
          <span style={{ color: "#f59e0b" }}>FUNNY</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/#income" className="hidden text-sm text-gray-400 transition hover:text-white md:block">← 수익 구조</Link>
          <Link href="/signup" className="rounded-full px-5 py-2 text-sm font-bold text-black" style={{ background: "#f59e0b" }}>무료 시작하기</Link>
        </div>
      </header>

      {/* HERO */}
      <FullBg src={BG.hero} overlay="linear-gradient(160deg, rgba(0,0,0,0.82) 0%, rgba(5,0,15,0.75) 100%)" className="pt-16">
        <div className="px-6 pb-24 pt-20 md:px-16">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            Revenue 03 · Referral Reward
          </div>
          <h1 className="text-[clamp(44px,9vw,112px)] font-black leading-[1.12] tracking-tight text-white">
            공유 하나로<br />
            <span style={{ color: "#f59e0b" }}>잠자면서도</span><br />
            수익이 쌓인다
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            추천 링크를 공유하고 친구가 가입을 완료하면 즉시 고정 수당이 지급됩니다.
            추천 인원 제한이 없어 공유할수록 수익이 무한히 늘어납니다.
          </p>

          {/* 수익 예시 계산 */}
          <div className="mt-10 max-w-lg rounded-2xl border p-6" style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", borderColor: "rgba(255,255,255,0.1)" }}>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>수익 시뮬레이션 (예시)</p>
            <div className="space-y-3">
              {[
                { n: "10명 추천", earn: "50,000원" },
                { n: "50명 추천", earn: "250,000원" },
                { n: "100명 추천", earn: "500,000원+" },
              ].map((r) => (
                <div key={r.n} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <span className="text-sm font-semibold text-white">{r.n}</span>
                  <span className="text-lg font-black" style={{ color: "#f59e0b" }}>{r.earn}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>* 건당 추천 수당 5,000원 기준 예시입니다. 실제 금액은 다를 수 있습니다.</p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 hover:opacity-90 transition-all" style={{ background: "#f59e0b" }}>
              지금 가입하고 추천 코드 받기
            </Link>
            <Link href="#how" className="rounded-full border px-8 py-4 text-base font-medium text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              작동 방식 보기
            </Link>
          </div>
        </div>
        {/* marquee */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-4" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="ref-marquee">
            {Array.from({ length: 8 }).flatMap((_, i) =>
              ["추천 수당", "가입 즉시 지급", "무제한 추천", "고정 수당", "REFERRAL REWARD", "PASSIVE INCOME"].map((w) => (
                <span key={`${i}-${w}`} className="mr-10 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{w} ·</span>
              ))
            )}
          </div>
        </div>
      </FullBg>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">How It Works</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl leading-[1.25]">
              4단계, 완전 자동
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
              가입부터 수당 적립까지 수동 작업이 전혀 없습니다. 링크를 공유하기만 하면 됩니다.
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

      {/* KEY FEATURES */}
      <FullBg src={BG.how} overlay="rgba(0,0,0,0.82)">
        <div className="mx-auto max-w-5xl px-6 py-24 md:px-16">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Benefits</p>
            <h2 className="text-4xl font-black text-white md:text-5xl leading-[1.25]">
              추천 수당의<br />핵심 장점
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "즉시 지급", desc: "가입 완료 즉시 수당이 적립됩니다. 별도 심사나 대기 기간이 없습니다.", badge: "Zero delay" },
              { title: "무제한 추천", desc: "추천 인원에 상한이 없습니다. 공유할수록 수당이 무한히 쌓입니다.", badge: "Unlimited" },
              { title: "고정 수당", desc: "추천 한 건당 정해진 금액이 고정으로 지급됩니다. 변동 없이 예측 가능합니다.", badge: "Fixed payout" },
              { title: "자동 추적", desc: "추천 링크 클릭부터 가입 완료까지 플랫폼이 자동으로 추적·기록합니다.", badge: "Auto-tracking" },
              { title: "대시보드 관리", desc: "추천 인원·적립 수당·출금 내역을 실시간으로 대시보드에서 확인합니다.", badge: "Real-time" },
              { title: "누적 수익", desc: "AI 납품·숏폼 배포 수익과 합산되어 지갑에 함께 관리됩니다.", badge: "Stacks up" },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                  {item.badge}
                </span>
                <h3 className="mt-3 font-black text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      {/* FAQ */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">FAQ</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl">자주 묻는 질문</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((faq, i) => (
              <details key={i} className="ref-faq overflow-hidden rounded-xl border border-gray-200 bg-white">
                <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5 font-bold text-gray-900 transition hover:bg-gray-50">
                  <span>{faq.q}</span>
                  <span className="ref-plus ml-4 shrink-0 text-2xl font-light text-gray-400">+</span>
                </summary>
                <div className="border-t border-gray-100 px-6 py-5 text-sm leading-relaxed text-gray-600">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <FullBg src={BG.income} overlay="rgba(0,0,0,0.70)">
        <div className="mx-auto max-w-3xl px-6 py-28 text-center md:px-16">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Start Now</p>
          <h2 className="text-[clamp(44px,8vw,88px)] font-black leading-[1.12] text-white">
            추천 코드<br /><span style={{ color: "#f59e0b" }}>지금 바로</span><br />받으세요
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
            가입 즉시 추천 코드 발급 · 가입비 0원 · 즉시 추천 활동 가능
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 transition-all" style={{ background: "#f59e0b" }}>
              무료 가입하고 추천 코드 받기 →
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
            <Link href="/revenue/ai-video" className="hover:text-white transition-colors">AI 영상 제작</Link>
            <Link href="/revenue/distribution" className="hover:text-white transition-colors">숏폼 배포</Link>
            <Link href="/signup" className="hover:text-white transition-colors">가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
