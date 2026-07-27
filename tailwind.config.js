/** @type {import('tailwindcss').Config} */
export default {
  // Fichiers de test exclus : leurs querySelector('.foo') et données
  // factices contiennent des mots qui ressemblent à des classes Tailwind
  // (ex: '.relative', '.overflow-hidden') sans en être un vrai usage JSX —
  // sans cette exclusion, chaque nouveau test fait dériver légèrement le
  // CSS de prod généré, pour des classes jamais réellement rendues.
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '!./src/**/*.test.{js,ts,jsx,tsx}', '!./src/test/**'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Palette "Animéaux" (moodboard : orange chaleureux). Le nom du
        // token (sage) est conservé tel quel pour ne pas avoir à renommer
        // les ~150 classes bg-sage-*/text-sage-*/etc. déjà utilisées dans
        // toute l'appli — seules les valeurs hex changent.
        sage: {
          50:  '#fff6e6',
          100: '#fce9c6',
          200: '#f8dba0',
          300: '#f5c275',
          400: '#f5a056',
          500: '#f2820f',
          600: '#d9670b',
          700: '#b8560a',
          800: '#8c4308',
          900: '#5a3a22',
        },
        // Vert sage : deuxième couleur "de données" à côté de l'orange
        // (sage-*) et du beige, pour remplacer les bleus/violets ponctuels.
        moss: {
          50:  '#f0f4ea',
          100: '#dee8d0',
          200: '#c3d3a8',
          500: '#8fa377',
          600: '#6f8557',
          700: '#566844',
          800: '#3f4d32',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
