import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Kannada"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        accent: {
          DEFAULT: "#10b981",
          hover: "#059669",
          muted: "rgba(16, 185, 129, 0.14)",
        },
      },
      borderRadius: {
        card: "14px",
        composer: "16px",
      },
    },
  },
  plugins: [typography],
} satisfies Config;

