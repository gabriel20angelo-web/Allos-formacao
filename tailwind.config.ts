import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FDFBF7",
        "cream-alt": "#F5F0E8",
        charcoal: "#1A1A1A",
        "dark-bg": "#111111",
        "dark-surface": "#1A1A1A",
        "dark-card": "#1E1E1E",
        "dark-elevated": "#252525",
        muted: "#5C5C5C",
        accent: "#C84B31",
        "accent-dark": "#A33D27",
        "accent-light": "#D4854A",
        "accent-glow": "rgba(200,75,49,0.15)",
        teal: {
          DEFAULT: "#2E9E8F",
          dark: "#1A7A6D",
          light: "#3ECFBE",
          bg: "#0D3B36",
        },
        border: "#E5DFD3",
        "dark-border": "rgba(255,255,255,0.08)",
        sage: "#2D6A4F",
        // ─── Surface overlays (escala de elevação no fundo dark) ──
        // surface-1 (mais sutil) → surface-3 (mais visível)
        "surface-1": "rgba(255,255,255,0.02)",
        "surface-2": "rgba(255,255,255,0.03)",
        "surface-3": "rgba(255,255,255,0.05)",
        "surface-4": "rgba(255,255,255,0.08)",
        // ─── Border tokens (sobre fundo dark) ────────────────────
        "border-soft": "rgba(255,255,255,0.06)",
        "border-soft-2": "rgba(255,255,255,0.08)",
        "border-soft-3": "rgba(255,255,255,0.12)",
        // ─── Accent variations ───────────────────────────────────
        "accent-soft": "rgba(200,75,49,0.1)",
        "accent-soft-2": "rgba(200,75,49,0.15)",
        "accent-soft-3": "rgba(200,75,49,0.2)",
        // ─── Cream variations (para texto sobre dark) ────────────
        "cream-30": "rgba(253,251,247,0.3)",
        "cream-40": "rgba(253,251,247,0.4)",
        "cream-50": "rgba(253,251,247,0.5)",
        "cream-60": "rgba(253,251,247,0.6)",
        "cream-70": "rgba(253,251,247,0.7)",
        "cream-90": "rgba(253,251,247,0.9)",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #C84B31, #A33D27)",
      },
      fontFamily: {
        fraunces: ["var(--font-fraunces)", "serif"],
        dm: ["var(--font-dm)", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        button: "10px",
        pill: "9999px",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0,0,0,0.08)",
        lifted: "0 8px 30px rgba(0,0,0,0.12)",
        "glow-orange": "0 4px 20px rgba(200,75,49,0.2)",
        "glow-orange-lg": "0 8px 40px rgba(200,75,49,0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [],
};

export default config;
