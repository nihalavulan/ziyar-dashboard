import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand palette derived from #002422 (deep teal).
        brand: {
          50: "#e6f1f0",
          100: "#c2dedb",
          200: "#97c4c0",
          300: "#64a49f",
          400: "#33827c",
          500: "#0f625d",
          600: "#002422",
          700: "#001d1b",
          800: "#001513",
          900: "#000d0c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
