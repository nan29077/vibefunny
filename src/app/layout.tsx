import type { Metadata, Viewport } from "next";
import { getSiteShareImage, getSiteUrl } from "@/lib/share-metadata";
import "./globals.css";

const SITE_NAME = "VIBEFUNNY";
const SITE_TITLE = "VIBEFUNNY | 숏폼 영상 부업 플랫폼";
const SITE_DESCRIPTION =
  "AI 영상 제작부터 숏폼 배포·쇼츠 커머스·추천 수익까지, 나만의 영상 부업을 시작하는 VIBEFUNNY입니다.";
const SHARE_TITLE = `숏폼으로 시작하는 나만의 영상 부업 | ${SITE_NAME}`;
const SHARE_DESCRIPTION = "AI로 영상을 만들고, 숏폼 캠페인과 쇼츠 커머스에 참여해 보세요.";

export function generateMetadata(): Metadata {
  const metadataBase = getSiteUrl();
  const shareImage = getSiteShareImage(metadataBase);
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
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      locale: "ko_KR",
      url: "/",
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
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
