import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        matcha: {
          DEFAULT: "#7FA36B",
          50: "#F4F7F1",
          100: "#E7EEE2",
          200: "#CFDEC6",
          300: "#B0C9A2",
          400: "#93B583",
          500: "#7FA36B",
          600: "#6B8F59",
          700: "#587649",
          800: "#475F3C",
          900: "#3B4F32",
        },
        sage: "#A8C49A",
        cream: "#F8F4EC",
        beige: "#E8DDC8",
        sand: "#DCCFB8",
        softwhite: "#FCFCFA",
        amethyst: {
          DEFAULT: "#A68BC8",
          50: "#F6F3FA",
          100: "#EDE8F5",
          200: "#D8CDE8",
          300: "#C3B2DB",
          400: "#B49DCF",
          500: "#A68BC8",
          600: "#8F70B4",
          700: "#77599A",
          800: "#5F477D",
          900: "#4C3965",
        },
        olive: "#364030",
        warmgray: "#6B6B6B",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(54, 64, 48, 0.08)",
        softer: "0 4px 20px rgba(54, 64, 48, 0.06)",
        lift: "0 12px 40px rgba(54, 64, 48, 0.14)",
        glow: "0 0 40px rgba(127, 163, 107, 0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "float-slow": "float 8s ease-in-out infinite",
        "float-slower": "float 12s ease-in-out infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        breathe: "breathe 8s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.25)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
