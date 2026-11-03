import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        muted: { DEFAULT: "var(--muted)", fg: "var(--muted-fg)" },
        border: "var(--border)",
        primary: { DEFAULT: "var(--primary)", fg: "var(--primary-fg)" },
        secondary: "var(--secondary)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      // DESIGN_SYSTEM.md §F — inputs/buttons 12px, cards 18–24px.
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "12px",
        lg: "18px",
        xl: "24px",
      },
      boxShadow: {
        DEFAULT: "0 1px 2px rgb(0 0 0 / 0.04)",
        md: "0 4px 16px rgb(0 0 0 / 0.08)",
        lg: "0 12px 40px rgb(0 0 0 / 0.12)",
      },
      // DESIGN_SYSTEM.md §D — system stack, display sizes via clamp().
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        display: ["clamp(2.75rem, 6vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(2rem, 4.5vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
        title: ["clamp(1.5rem, 3vw, 2rem)", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.9375rem", { lineHeight: "1.6" }],
        caption: ["0.8125rem", { lineHeight: "1.5" }],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: { "fade-in": "fade-in 160ms ease-out" },
    },
  },
  plugins: [],
};

export default config;
