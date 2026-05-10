import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-primary": "var(--color-brand-primary)",
        "brand-primary-ink": "var(--color-brand-primary-ink)",
        "brand-secondary": "var(--color-brand-secondary)",
        "brand-secondary-ink": "var(--color-brand-secondary-ink)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        success: "var(--color-success)",
        "success-ink": "var(--color-success-ink)",
        warning: "var(--color-warning)",
        "warning-ink": "var(--color-warning-ink)",
        danger: "var(--color-danger)",
        "danger-ink": "var(--color-danger-ink)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
      },
      borderRadius: {
        button: "var(--radius-button)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        pill: "var(--radius-pill)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        label: ["13px", { lineHeight: "18px", fontWeight: "500", letterSpacing: "0.01em" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        h3: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        h2: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h1: ["28px", { lineHeight: "36px", fontWeight: "700" }],
        display: ["36px", { lineHeight: "44px", fontWeight: "700" }],
        "mono-sm": ["13px", { lineHeight: "18px", fontWeight: "500" }],
        mono: ["14px", { lineHeight: "20px", fontWeight: "500" }],
      },
      transitionDuration: {
        instant: "var(--motion-instant-duration)",
        screen: "var(--motion-screen-duration)",
      },
      transitionTimingFunction: {
        "ease-out-soft": "var(--motion-ease-out)",
      },
      boxShadow: {
        "elevation-sm": "var(--elevation-sm)",
        "elevation-md": "var(--elevation-md)",
        "elevation-lg": "var(--elevation-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
