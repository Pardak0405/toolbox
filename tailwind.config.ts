import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./tools/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        fog: "var(--fog)",
        ember: "var(--ember)",
        emberDark: "var(--ember-dark)",
        line: "var(--line)",
        muted: "var(--muted)"
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 23, 42, 0.08)",
        float: "0 18px 50px rgba(15, 23, 42, 0.12)"
      },
      borderRadius: {
        xl: "1.1rem"
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)"
      }
    }
  },
  plugins: []
} satisfies Config;
