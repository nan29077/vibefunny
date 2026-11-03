"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlay } from "@/components/icons";
import { BANNER_IMAGE_SLOTS } from "@/lib/site-images";

const defaultImages = BANNER_IMAGE_SLOTS.map((slot) => slot.original);

const slides = [
  { eyebrow: "SHORTFORM SIDE JOB", title: <><span className="vf-hero-title-line">숏폼으로 나만의</span><span className="vf-hero-title-line"><em>수익을 시작하세요</em></span></>, body: "캠페인 배포 · 캠페인 영상 제작 · 쇼츠 커머스 · 추천 수당. 바이브퍼니의 네 가지 수익 파이프라인을 한 곳에서 시작합니다." },
  { eyebrow: "CREATE & SHARE", title: <>하루 한 편,<br /><em>수익의 씨앗</em>을 심어요</>, body: "영상 경험이 없어도 괜찮아요. 가이드를 따라 만들고, 여러 플랫폼으로 배포하며 수익 기회를 넓혀보세요." },
  { eyebrow: "GROW YOUR HIVE", title: <>쌓일수록 더 달콤한<br /><em>월 수익 로드맵</em></>, body: "입문부터 숙련까지, 현재 바이브퍼니 수익 로드맵과 시뮬레이션을 확인하며 내 속도로 성장할 수 있어요." },
];

export function HoneyHeroCarousel({ ctaHref = "/signup", images = defaultImages }: { ctaHref?: string; images?: readonly string[] }) {
  const [active, setActive] = useState(0);
  // 마우스를 올리거나 키보드로 포커스가 들어오면 자동 넘김을 멈춘다 (읽는 도중 바뀌지 않도록)
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused]);
  const go = (direction: number) => setActive((active + direction + slides.length) % slides.length);

  return (
    <section
      className="vf-honey-hero"
      aria-roledescription="carousel"
      aria-label="바이브퍼니 숏폼 부업 소개"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
    >
      {slides.map((slide, index) => (
        <div key={slide.eyebrow} className={`vf-hero-slide ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index]} alt="" className="vf-hero-image" />
          <div className="vf-hero-shade" />
          <div className="vf-honeycomb" aria-hidden />
          <div className="vf-hero-copy">
            <p className="vf-hero-eyebrow"><span />{slide.eyebrow}</p>
            {index === 0 ? <h1>{slide.title}</h1> : <h2>{slide.title}</h2>}
            <p className="vf-hero-body">{slide.body}</p>
            <div className="vf-hero-actions">
              <Link href={ctaHref} className="vf-honey-button" tabIndex={index === active ? undefined : -1}>지금 바로 시작하기 <IconPlay size={15} /></Link>
            </div>
          </div>
        </div>
      ))}
      <div className="vf-hero-arrows" aria-label="배너 이동">
        <button type="button" onClick={() => go(-1)} aria-label="이전 슬라이드"><IconChevronLeft size={22} /></button>
        <button type="button" onClick={() => go(1)} aria-label="다음 슬라이드"><IconChevronRight size={22} /></button>
      </div>
      <div className="vf-hero-dots vf-hero-pagination">{slides.map((slide, index) => <button key={slide.eyebrow} onClick={() => setActive(index)} aria-label={`${index + 1}번 슬라이드`} className={active === index ? "is-active" : ""} />)}</div>
    </section>
  );
}
