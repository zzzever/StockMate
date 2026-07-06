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
        sans: ['Inter', 'Noto Sans SC', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'ui-monospace', 'monospace'],
        serif: ['Noto Serif SC', 'serif'],
      },
      borderRadius: {
        'xl': 'var(--radius-xl)',
        'lg': 'var(--radius-lg)',
        'md': 'var(--radius-md)',
        'sm': 'var(--radius-sm)',
      },
    },
  },
  plugins: [],
}
