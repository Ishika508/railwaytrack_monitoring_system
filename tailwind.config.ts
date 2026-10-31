import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  safelist: ["bg-ok", "bg-warn", "bg-bad", "text-ok", "text-warn", "text-bad"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        surface2: c("surface2"),
        border: c("border"),
        ink: c("ink"),
        muted: c("muted"),
        primary: c("primary"),
        accent: c("accent"),
        ok: c("ok"),
        warn: c("warn"),
        bad: c("bad"),
        info: c("info"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        ping2: { "0%": { transform: "scale(1)", opacity: ".6" }, "100%": { transform: "scale(2.4)", opacity: "0" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-up": "fadeUp .45s ease both",
        ping2: "ping2 1.6s cubic-bezier(0,0,.2,1) infinite",
        floaty: "floaty 4s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
