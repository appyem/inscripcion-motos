// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        conservative: {
          primary: '#0033A0',
          secondary: '#0055D4',
          light: '#E6F0FF',
          dark: '#002266',
        }
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
};