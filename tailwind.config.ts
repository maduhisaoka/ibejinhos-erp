import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        cocoa: "#006f82",
        truffle: "#0097b2",
        cream: "#f1fdff",
        blush: "#ff66c4",
        rose: "#ff8ed4",
        gold: "#0cc0df",
        pistachio: "#58d5e8"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0, 111, 130, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
