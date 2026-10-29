import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const SITE_NAME = "VIBEFUNNY";
const SITE_TITLE = "VIBEFUNNY | 숏폼 영상 부업 플랫폼";
const SITE_DESCRIPTION =
  "AI 영상 제작부터 숏폼 배포·쇼츠 커머스·추천 수익까지, 나만의 영상 부업을 시작하는 VIBEFUNNY입니다.";

function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try { return new URL(configured); } catch { /* use the request host */ }
  }
  // 운영에서는 위조 가능한 Host 헤더로 대표 주소(canonical·공유 미리보기)를 만들지 않는다
  if (process.env.NODE_ENV === "production") {
    console.warn("[layout] NEXT_PUBLIC_SITE_URL 이 설정되지 않아 기본 주소(https://vibefunny.com)를 사용합니다.");
    return new URL("https://vibefunny.com");
  }
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return new URL(`${protocol}://${host}`);
}

export function generateMetadata(): Metadata {
  const metadataBase = getSiteUrl();
  const shareImage = new URL("/og.png", metadataBase).toString();
  return {
    metadataBase,
    title: {
      default: SITE_TITLE,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: ["영상 부업", "AI 영상", "숏폼 배포", "쇼츠 커머스", "부업", "VIBEFUNNY"],
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      ],
      apple: [{ url: "/images/brand/vibefunny-mark.svg", type: "image/svg+xml", sizes: "any" }],
      shortcut: "/favicon.svg",
    },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      locale: "ko_KR",
      url: "/",
      images: [{ url: shareImage, width: 1200, height: 630, alt: "VIBEFUNNY 숏폼 영상 부업 플랫폼" }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [shareImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffc928",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
