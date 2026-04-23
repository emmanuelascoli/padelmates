/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Forest green palette — kept for backward compatibility
        forest: {
          50:  '#f0f7f2',
          100: '#d9ede0',
          200: '#b3dbc2',
          300: '#82c19e',
          400: '#50a378',
          500: '#30875a',
          600: '#226b47',
          700: '#1b5538',
          800: '#16422c',
          900: '#112f1f',
          950: '#091a12',
        },

        // ── Design-token-backed colors (opacity modifier supported) ──
        // Usage: bg-primary, bg-primary/50, text-primary, border-primary …
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          hover:   'rgb(var(--color-primary-hover-rgb) / <alpha-value>)',
        },

        // Usage: bg-accent, bg-accent/80, text-accent, bg-accent-bg
        accent: {
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          bg:      'var(--color-accent-bg)',
        },

        // Usage: bg-app-bg, bg-app-surface, bg-app-surface-2
        'app-bg':      'var(--color-bg)',
        'app-surface': 'var(--color-surface)',
      },
    },
  },
  plugins: [],
}
