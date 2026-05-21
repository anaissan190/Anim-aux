/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#78350F',
        },
        cream: '#FFFBF5',
      },
      fontFamily: {
        fredoka: ['"Fredoka One"', 'cursive'],
        nunito: ['"Nunito"', 'sans-serif'],
      },
      borderRadius: {
        xl:  '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}