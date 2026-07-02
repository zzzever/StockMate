/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        up: 'hsl(var(--price-up) / <alpha-value>)',
        down: 'hsl(var(--price-down) / <alpha-value>)',
        surface: {
          card: 'hsl(var(--bg-card) / <alpha-value>)',
          sidebar: 'hsl(var(--bg-sidebar) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xl': 'var(--radius-xl)',
        'lg': 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
}
