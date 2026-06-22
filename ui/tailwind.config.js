/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        up: '#10b981',
        down: '#f43f5e',
        bg: {
          DEFAULT: '#09090b',
        },
      },
    },
  },
  plugins: [],
}
