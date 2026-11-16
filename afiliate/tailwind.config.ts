import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C1410",
        paper: "#F7F1E8",
        brick: "#C23A2B",
        brickDark: "#9A2C21",
        moss: "#2F6B4F",
        sand: "#E7DCCB",
        mute: "#6B5E52",
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', "Thonburi", "Sarabun", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
