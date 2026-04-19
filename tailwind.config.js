/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Forest green palette — primary brand color
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
          900: '#112f1f',  // Main brand — header, buttons, FAB, date column
          950: '#091a12',
        },
      },
    },
  },
  plugins: [],
}
