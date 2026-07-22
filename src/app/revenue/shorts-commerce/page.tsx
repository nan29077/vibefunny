import Link from "next/link";

export const metadata = {
  title: "유튜브 쇼츠 커머스 수익 | VIBEFUNNY",
  description: "내 유튜브 채널을 운영하며 숏폼에 상품을 연동해 판매 수수료를 버는 새로운 수익 구조. 카페24 연동 상품을 쇼츠에 연결하면 판매할 때마다 수익이 적립됩니다.",
};

const BG = {
  hero:   "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1920&q=85&fit=crop&auto=format",
  flow:   "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&q=85&fit=crop&auto=format",
  income: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85&fit=crop&auto=format",
};

const STEPS = [
  { n: "01", title: "운영 채널 등록", desc: "광고용 계정과 별개로, 내가 직접 운영할 '채널 운영용 유튜브 계정'을 등록합니다." },
  { n: "02", title: "쇼츠 제작 & 업로드", desc: "상품을 소개하는 숏폼(쇼츠) 영상을 제작해 내 유튜브 채널에 올립니다." },
  { n: "03", title: "링크 입력 → 상품 추천", desc: "업로드한 쇼츠 링크를 입력하면 영상 내용과 어울리는 상품을 자동으로 추천해 드립니다." },
  { n: "04", title: "상품 연동 & 수익 적립", desc: "추천 상품을 선택해 쇼츠에 연동하면, 시청자가 구매할 때마다 판매 수수료가 적립됩니다." },
];

const INCOME_TABLE = [
  { cat: "뷰티 (수분 세럼)",     price: "24,900",  rate: "12%", payout: "2,988" },
  { cat: "패션 (후드 티셔츠)",   price: "32,000",  rate: "15%", payout: "4,800" },
  { cat: "식품 (원두 커피)",     price: "21,900",  rate: "10%", payout: "2,190" },
  { cat: "디지털 (무선 이어폰)", price: "59,000",  rate: "8%",  payout: "4,720" },
  { cat: "반려 (관절 영양제)",   price: "29,000",  rate: "14%", payout: "4,060" },
];

const SIM = [
  { label: "가볍게 (월 4편)",   sales: "쇼츠당 월 5건 판매", income: "약 6~10만원" },
  { label: "꾸준히 (월 12편)",  sales: "쇼츠당 월 8건 판매", income: "약 25~40만원" },
  { label: "전업급 (월 30편)",  sales: "쇼츠당 월 12건 판매", income: "약 90~150만원" },
];

function FullBg({
  src, overlay = "rgba(0,0,0,0.72)", children, className = "", id,
}: {
  src: string; overlay?: string; children: React.ReactNode; className?: string; id?: string;
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

export default function ShortsCommerceRevenuePage() {
  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12"
        style={{ background: "rgba(6,6,6,0.90)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/" className="text-xl font-black">
          <span className="text-white">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/#income" className="hidden text-sm text-gray-400 transition hover:text-white md:block">← 수익 구조</Link>
          <Link href="/signup" className="rounded-full px-5 py-2 text-sm font-bold text-black" style={{ background: "#f59e0b" }}>무료 시작하기</Link>
        </div>
      </header>

      {/* HERO */}
      <FullBg src={BG.hero} overlay="linear-gradient(160deg, rgba(10,0,25,0.88) 0%, rgba(0,0,0,0.78) 100%)" className="pt-16">
        <div className="px-6 pb-24 pt-20 md:px-16">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            Revenue 04 · YouTube Shorts Commerce
          </div>
          <h1 className="text-[clamp(40px,8vw,104px)] font-black leading-[1.12] tracking-tight text-white">
            내 쇼츠가<br />
            <span style={{ color: "#f59e0b" }}>매장이 된다</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            내 유튜브 채널을 운영하며 숏폼에 상품을 연동하세요. 관리자가 등록한 카페24 연동 상품 중
            영상과 어울리는 것을 추천받아 연결하면, 시청자가 구매할 때마다 판매 수수료가 수익이 됩니다.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              { v: "내 채널", l: "직접 운영하는 숏폼 채널" },
              { v: "추천", l: "영상 맞춤 상품 자동 추천" },
              { v: "수수료", l: "판매가의 8~15% 적립" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border p-4 text-center" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="text-xl font-black" style={{ color: "#f59e0b" }}>{s.v}</div>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 hover:opacity-90 transition-all" style={{ background: "#f59e0b" }}>지금 시작하기</Link>
            <Link href="#flow" className="rounded-full border px-8 py-4 text-base font-medium text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}>수익 구조 보기</Link>
          </div>
        </div>
      </FullBg>

      {/* FLOW */}
      <section id="flow" className="px-6 py-24 md:px-16" style={{ background: "#fafafa" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">How it works</p>
            <h2 className="text-4xl font-black text-gray-900 md:text-5xl leading-[1.25]">4단계로<br />수익이 만들어집니다</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="text-3xl font-black" style={{ color: "#f59e0b" }}>{s.n}</div>
                <h3 className="mt-3 text-lg font-black text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INCOME STRUCTURE */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#0a0a0f" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Revenue Structure</p>
            <h2 className="text-4xl font-black text-white md:text-5xl leading-[1.25]">상품 1건 판매 시<br /><span style={{ color: "#f59e0b" }}>이만큼 적립됩니다</span></h2>
            <p className="mx-auto mt-4 max-w-lg text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
              수익 = <strong className="text-white">판매가 × 수수료율</strong>. 수수료율은 상품마다 관리자가 설정합니다. (아래는 예시)
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th className="px-5 py-4 font-bold text-white">상품 (카테고리)</th>
                  <th className="px-5 py-4 font-bold text-white">판매가</th>
                  <th className="px-5 py-4 font-bold text-white">수수료율</th>
                  <th className="px-5 py-4 font-bold" style={{ color: "#f59e0b" }}>건당 적립</th>
                </tr>
              </thead>
              <tbody>
                {INCOME_TABLE.map((r) => (
                  <tr key={r.cat} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="px-5 py-4 text-white">{r.cat}</td>
                    <td className="px-5 py-4" style={{ color: "rgba(255,255,255,0.7)" }}>{r.price}원</td>
                    <td className="px-5 py-4" style={{ color: "rgba(255,255,255,0.7)" }}>{r.rate}</td>
                    <td className="px-5 py-4 font-black" style={{ color: "#f59e0b" }}>{r.payout}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            * 한 쇼츠에 여러 상품을 연동할 수 있어, 영상 1편이 여러 수익원이 됩니다.
          </p>
        </div>
      </section>

      {/* SIMULATION */}
      <FullBg src={BG.income} overlay="rgba(0,0,5,0.85)">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-16">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Simulation</p>
            <h2 className="text-4xl font-black text-white md:text-5xl leading-[1.25]">활동량별<br />예상 월 수익</h2>
            <p className="mx-auto mt-4 max-w-md text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>실제 수익은 영상 조회수·상품·전환율에 따라 달라집니다.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {SIM.map((s, i) => (
              <div key={s.label} className="rounded-2xl p-7" style={{ background: i === 1 ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${i === 1 ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.1)"}` }}>
                <h3 className="text-lg font-black text-white">{s.label}</h3>
                <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{s.sales}</p>
                <div className="mt-5 text-3xl font-black" style={{ color: "#f59e0b" }}>{s.income}</div>
              </div>
            ))}
          </div>
        </div>
      </FullBg>

      {/* EXTRA REVENUE: 쇼츠 자체 수익 + 맞구독 */}
      <section className="px-6 py-24 md:px-16" style={{ background: "#0d0d12" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>More than commerce</p>
            <h2 className="text-4xl font-black text-white md:text-5xl leading-[1.25]">상품 판매 <span style={{ color: "#f59e0b" }}>그 이상의 수익</span></h2>
            <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
              쇼츠 커머스는 상품 수수료뿐 아니라, 쇼츠 영상 자체와 채널 성장에서도 수익이 만들어집니다.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="text-3xl">🎬</div>
              <h3 className="mt-3 text-xl font-black text-white">쇼츠 자체 수익 구조</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                내 채널에 올린 쇼츠는 상품 판매 수수료와 별개로, <strong className="text-white">조회수 기반 유튜브 쇼츠 수익화</strong>로도
                수익이 발생합니다. 영상 한 편이 &quot;상품 판매 + 영상 자체 수익&quot; 두 갈래로 수익을 냅니다.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                <li className="flex gap-2"><span style={{ color: "#f59e0b" }}>→</span> 상품 판매 수수료 (판매가 × 수수료율)</li>
                <li className="flex gap-2"><span style={{ color: "#f59e0b" }}>→</span> 쇼츠 조회수 기반 영상 수익</li>
                <li className="flex gap-2"><span style={{ color: "#f59e0b" }}>→</span> 콘텐츠 누적 = 수익 누적</li>
              </ul>
            </div>
            <div className="rounded-2xl p-7" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <div className="text-3xl">🤝</div>
              <h3 className="mt-3 text-xl font-black text-white">맞구독으로 즉시 수익 채널 전환</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                VIBEFUNNY 회원 간 <strong className="text-white">맞구독</strong>으로 초기 구독자를 빠르게 확보하세요.
                구독자가 쌓이면 내 채널이 곧바로 &quot;수익 채널&quot;로 전환되어, 쇼츠 커머스와 영상 수익화가 즉시 작동합니다.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                <li className="flex gap-2"><span style={{ color: "#f59e0b" }}>→</span> 회원 맞구독으로 초기 구독자 확보</li>
                <li className="flex gap-2"><span style={{ color: "#f59e0b" }}>→</span> 수익화 조건 도달 가속</li>
                <li className="flex gap-2"><span style={{ color: "#f59e0b" }}>→</span> 커머스 + 영상 수익 동시 가동</li>
              </ul>
              <a href="/creator/community" className="mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-black text-black transition hover:opacity-90" style={{ background: "#f59e0b" }}>SNS 맞구독 보러가기 →</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-28 text-center md:px-16" style={{ background: "#060606" }}>
        <h2 className="mx-auto max-w-3xl text-4xl font-black leading-[1.2] text-white md:text-6xl">
          내 채널을<br /><span style={{ color: "#f59e0b" }}>작은 쇼핑몰로</span> 만드세요
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
          상품 소싱·결제·배송은 카페24 연동으로 처리됩니다. 크리에이터는 좋은 콘텐츠 제작에만 집중하세요.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/signup" className="rounded-full px-8 py-4 text-base font-black text-black hover:scale-105 transition-all" style={{ background: "#f59e0b" }}>크리에이터로 가입하기</Link>
          <Link href="/creator/shorts-commerce" className="rounded-full border px-8 py-4 text-base font-medium text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}>쇼츠 커머스 바로가기</Link>
        </div>
      </section>
    </>
  );
}
