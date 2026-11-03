import { headers } from "next/headers";

const SITE_SHARE_IMAGE = {
  url: "/vibefunny-share-v2.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "숏폼을 촬영하는 크리에이터와 ‘숏폼으로 시작하는 나만의 영상 부업’이라는 바이브퍼니 슬로건",
};

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try { return new URL(configured); } catch { /* use the environment fallback */ }
  }
  // 운영에서는 요청 헤더 대신 설정된 대표 주소를 사용한다.
  if (process.env.NODE_ENV === "production") {
    console.warn("[layout] NEXT_PUBLIC_SITE_URL 이 설정되지 않아 기본 주소(https://vibefunny.com)를 사용합니다.");
    return new URL("https://vibefunny.com");
  }
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return new URL(`${protocol}://${host}`);
}

export function getSiteShareImage(siteUrl: URL) {
  // Next.js 개발 모드는 상대 소셜 이미지 주소를 localhost 기준으로 해석한다.
  return { ...SITE_SHARE_IMAGE, url: new URL(SITE_SHARE_IMAGE.url, siteUrl).href };
}
