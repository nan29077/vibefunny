import type { Config } from "tailwindcss";

// VIBEACTION 디자인 톤: 밝고 경쾌 (Purple / Pink / Yellow)
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#171717",
          pink: "#f4b000",
          yellow: "#ffc928",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
