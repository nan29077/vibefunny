"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IconFilm, IconGlobe, IconBarChart } from "@/components/icons";

const slides = [
  {
    id: 1,
    image:
      "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1920&q=80",
    BadgeIcon: IconFilm,
    badgeText: "AI 영상 제작 부업",
    title: "AI 영상을 만들고\n팔아서 수익내기",
    description:
      "Gemini · Veo로 제작한 영상을 마켓에 등록하세요.\n구매자가 결제하면 수익이 바로 정산됩니다.",
    cta: "크리에이터로 시작하기",
    ctaLink: "/signup",
    ctaSecondary: "영상 마켓 둘러보기",
    ctaSecondaryLink: "/buyer/market",
    accent: "from-purple-600 to-pink-500",
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1920&q=80",
    BadgeIcon: IconGlobe,
    badgeText: "숏폼 배포 수익",
    title: "내 채널에 숏폼 올리고\n매달 수익 받기",
    description:
      "YouTube · Instagram · TikTok 계정에 광고 숏폼을 배포하세요.\n1건 배포마다 포인트가 쌓이고 현금으로 출금할 수 있습니다.",
    cta: "배포자로 가입하기",
    ctaLink: "/signup",
    ctaSecondary: "캠페인 목록 보기",
    ctaSecondaryLink: "/signup",
    accent: "from-pink-500 to-orange-400",
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=1920&q=80",
    BadgeIcon: IconBarChart,
    badgeText: "포인트 광고 집행",
    title: "포인트 충전 한 번으로\n캠페인 손쉽게 집행",
    description:
      "광고주는 포인트를 충전하고 원하는 플랫폼·카테고리에 광고를 집행하세요.\n투명한 결과 리포트로 효율을 바로 확인할 수 있습니다.",
    cta: "광고주로 시작하기",
    ctaLink: "/signup",
    ctaSecondary: "요금제 알아보기",
    ctaSecondaryLink: "/signup",
    accent: "from-yellow-400 to-orange-500",
  },
];

export function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loaded, setLoaded] = useState<boolean[]>(() => slides.map((_, i) => i === 0));

  // 첫 화면은 첫 슬라이드 이미지 1장만 로드하고, 나머지는 첫 페인트 이후 프리페치
  useEffect(() => {
    const t = setTimeout(() => setLoaded(slides.map(() => true)), 2000);
    return () => clearTimeout(t);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setLoaded((prev) => (prev[index] ? prev : prev.map((v, i) => (i === index ? true : v))));
      setIsTransitioning(true);
      setCurrent(index);
      setTimeout(() => setIsTransitioning(false), 600);
    },
    [isTransitioning]
  );

  const prev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length);
  }, [current, goTo]);

  const next = useCallback(() => {
    goTo((current + 1) % slides.length);
  }, [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 5500);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];
  const BadgeIcon = slide.BadgeIcon;

  return (
    <section className="relative h-screen min-h-[600px] w-full overflow-hidden">
      {/* Background Images */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: i === current ? 1 : 0,
            backgroundImage: loaded[i] ? `url('${s.image}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        {/* Badge */}
        <span
          className={`mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${slide.accent} px-4 py-1.5 text-sm font-bold text-white shadow-lg transition-all duration-500`}
        >
          <BadgeIcon size={14} />
          {slide.badgeText}
        </span>

        {/* Title */}
        <h1
          className="text-4xl font-extrabold leading-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl"
          style={{ whiteSpace: "pre-line" }}
        >
          {slide.title}
        </h1>

        {/* Description */}
        <p
          className="mx-auto mt-5 max-w-2xl text-base text-white/80 sm:text-lg"
          style={{ whiteSpace: "pre-line" }}
        >
          {slide.description}
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={slide.ctaLink}
            className={`inline-flex items-center rounded-xl bg-gradient-to-r ${slide.accent} px-6 py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90 hover:scale-105 active:scale-100`}
          >
            {slide.cta}
          </Link>
          <Link
            href={slide.ctaSecondaryLink}
            className="inline-flex items-center rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            {slide.ctaSecondary}
          </Link>
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-3 text-white backdrop-blur-sm transition hover:bg-black/50 sm:left-8"
        aria-label="이전 슬라이드"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-3 text-white backdrop-blur-sm transition hover:bg-black/50 sm:right-8"
        aria-label="다음 슬라이드"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dot Indicators */}
      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`슬라이드 ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-8 right-6 z-20 text-sm font-semibold text-white/70">
        {current + 1} / {slides.length}
      </div>
    </section>
  );
}
