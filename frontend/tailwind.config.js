/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        themis: {
          navy: "#24244f",
          "navy-dark": "#181836",
          "navy-light": "#313166",
          "navy-subtle": "#3e3e7a",
          white: "#ffffff",
          lime: "#d4f717",
          "lime-hover": "#bfe010",
          "lime-light": "#f3fde0",
          violet: "#5a38fd",
          "violet-hover": "#4a2bdc",
          "violet-light": "#ede8ff",
        },
      },
      fontFamily: {
        display: ["Cabinet Grotesk", "Syne", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
