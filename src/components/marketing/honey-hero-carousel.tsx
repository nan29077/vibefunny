"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlay } from "@/components/icons";

const slides = [
  { image: "/images/hero/side-income-1.png", eyebrow: "SHORTFORM SIDE JOB", title: <>숏폼으로<br /><em>나만의 수익</em>을 시작하세요</>, body: "AI 영상 제작 · 숏폼 배포 · 추천 수당. 기존 바이브퍼니의 세 가지 수익 파이프라인을 한 곳에서 시작합니다." },
  { image: "/images/hero/side-income-2.png", eyebrow: "CREATE & SHARE", title: <>하루 한 편,<br /><em>수익의 씨앗</em>을 심어요</>, body: "영상 경험이 없어도 괜찮아요. 가이드를 따라 만들고, 여러 플랫폼으로 배포하며 수익 기회를 넓혀보세요." },
  { image: "/images/hero/side-income-3.png", eyebrow: "GROW YOUR HIVE", title: <>쌓일수록 더 달콤한<br /><em>월 수익 로드맵</em></>, body: "입문부터 숙련까지, 현재 바이브퍼니 수익 로드맵과 시뮬레이션을 확인하며 내 속도로 성장할 수 있어요." },
];

export function HoneyHeroCarousel() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  const go = (direction: number) => setActive((active + direction + slides.length) % slides.length);

  return (
    <section className="vf-honey-hero" aria-roledescription="carousel" aria-label="바이브퍼니 숏폼 부업 소개">
      {slides.map((slide, index) => (
        <div key={slide.image} className={`vf-hero-slide ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.image} alt="숏폼 콘텐츠를 제작하는 크리에이터" className="vf-hero-image" />
          <div className="vf-hero-shade" />
          <div className="vf-honeycomb" aria-hidden />
          <div className="vf-hero-copy">
            <p className="vf-hero-eyebrow"><span />{slide.eyebrow}</p>
            <h1>{slide.title}</h1>
            <p className="vf-hero-body">{slide.body}</p>
            <div className="vf-hero-actions">
              <Link href="/signup" className="vf-honey-button">지금 바로 시작하기 <IconPlay size={15} /></Link>
            </div>
          </div>
        </div>
      ))}
      <div className="vf-hero-arrows" aria-label="배너 이동">
        <button type="button" onClick={() => go(-1)} aria-label="이전 슬라이드"><IconChevronLeft size={22} /></button>
        <button type="button" onClick={() => go(1)} aria-label="다음 슬라이드"><IconChevronRight size={22} /></button>
      </div>
      <div className="vf-hero-dots vf-hero-pagination">{slides.map((slide, index) => <button key={slide.image} onClick={() => setActive(index)} aria-label={`${index + 1}번 슬라이드`} className={active === index ? "is-active" : ""} />)}</div>
    </section>
  );
}
