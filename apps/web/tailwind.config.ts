
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#f97316",   // Orange-500
        primaryDark: "#ea580c",
        primaryLight: "#fb923c"
      }
    },
  },
  plugins: [],
};
export default config;
