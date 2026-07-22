/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolate this app's Next output from stale files held by a previous local preview.
  distDir: process.env.VF_NEXT_DIST_DIR || ".next-vibefunny",

  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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
