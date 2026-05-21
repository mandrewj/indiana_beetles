import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "#EEF4FF",
          100: "#D9E5FF",
          200: "#B3CBFF",
          300: "#7AA5FF",
          400: "#4783FA",
          500: "#2C7AFB",
          600: "#116dff",
          700: "#0A4FBE",
          800: "#0A3F95",
          900: "#0A2D6B",
        },
        gray: {
          100: "#EEF1F2",
          200: "#D9DDDF",
          300: "#B7BDC0",
          400: "#8A9094",
          500: "#6F7478",
          600: "#5f6360",
          700: "#4A4F50",
          800: "#363A3B",
        },
        text: {
          100: "#F2F2F2",
          200: "#D5D5D5",
          300: "#A5A5A5",
          400: "#6D6F6E",
          500: "#404342",
          600: "#1F2222",
          700: "#080808",
        },
        surface: {
          0: "#FFFFFF",
          1: "#F8F9FA",
          2: "#F1F3F5",
          3: "#E5E7EB",
        },
        cyan: {
          400: "#3FB6D8",
          500: "#1F95B8",
          600: "#0E7693",
        },
        ok: {
          black: "#000000",
          orange: "#E69F00",
          skyblue: "#56B4E9",
          green: "#009E73",
          yellow: "#F0E442",
          blue: "#0072B2",
          vermillion: "#D55E00",
          purple: "#CC79A7",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-lato)",
          "Lato",
          "Helvetica",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      backgroundImage: {
        page: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 100%)",
      },
      boxShadow: {
        card:
          "0 1px 0 rgba(15, 23, 42, 0.04), 0 4px 16px -8px rgba(15, 23, 42, 0.10)",
      },
      letterSpacing: {
        tightish: "-0.005em",
      },
    },
  },
  plugins: [],
};

export default config;
