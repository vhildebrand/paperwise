/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'suggestion-spelling',
    'suggestion-grammar',
    'suggestion-style',
    'suggestion-selected',
  ],
  theme: {
    extend: {},
  },
  variants: {
    extend: {
      backgroundColor: ['data-active'],
      textColor: ['data-active'],
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 