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
      fontSize: {
        'data-xs': ['0.625rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }],
        'data-sm': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body': ['0.8125rem', { lineHeight: '1.5' }],
        'heading-sm': ['0.875rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '-0.005em' }],
        'heading': ['1rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '-0.01em' }],
        'display': ['1.25rem', { lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.015em' }],
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-xxl)',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'dropdown': 'var(--shadow-dropdown)',
        'modal': 'var(--shadow-modal)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
      },
      width: {
        'sidebar': 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed)',
      },
      spacing: {
        'grid': 'var(--grid-unit)',
        'gutter': 'var(--grid-gutter)',
      },
    },
  },
  plugins: [],
}
