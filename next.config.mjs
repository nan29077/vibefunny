/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolate this app's Next output from stale files held by a previous local preview.
  // Docker 빌드 시: VF_NEXT_DIST_DIR=.next 으로 설정하여 표준 경로 사용
  distDir: process.env.VF_NEXT_DIST_DIR || ".next-vibefunny",
  // AWS 배포 시 standalone 출력 모드 사용 (Docker 이미지 최적화)
  // 로컬 개발 시 standalone 출력은 비활성화 (번들 크기 축소 목적)
  output: process.env.VF_NEXT_DIST_DIR ? "standalone" : undefined,

  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  images: {
    // 보안: 외부 임의 주소 이미지 최적화(열린 프록시) 차단. next/image 는 사이트 내부 이미지(/images/...)만 사용한다.
    // AVIF 인코딩 경로의 알려진 취약점을 피하기 위해 webp 만 사용한다.
    formats: ["image/webp"],
    minimumCacheTTL: 60,
    remotePatterns: [],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // AI 숏츠 작업 엔진(백그라운드 처리)을 서버 시작 시 함께 띄운다 (src/instrumentation.ts)
    instrumentationHook: true,
    // ffmpeg 실행 파일 경로를 런타임에 찾으므로 번들에서 제외한다
    serverComponentsExternalPackages: ["ffmpeg-static"],
  },

  webpack: (config, { dev }) => {
    // Prevent stale Fast Refresh module records in tunnel/mobile development previews.
    if (dev) config.cache = false;
    return config;
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 브라우저가 항상 https 로 접속하도록 (http 로컬 개발에서는 브라우저가 무시함)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // 콘텐츠 보안 정책(최소 범위): 플러그인 객체·base 태그 변조·외부 사이트 프레임 삽입·외부로의 폼 전송 차단.
          // 스크립트/이미지 출처는 Next.js 인라인 스크립트와 외부 썸네일 때문에 제한하지 않는다.
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        // Dev preview URLs keep the same chunk paths between hot reloads.
        // Do not let mobile browsers retain an outdated module factory.
        headers: [{ key: "Cache-Control", value: process.env.NODE_ENV === "production" ? "public, max-age=31536000, immutable" : "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
