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
        },
        // Neutre chaud (beige) pour les bordures/séparateurs — remplace le
        // gray-* par défaut de Tailwind, trop froid pour la palette orange/
        // sauge de l'appli (refonte visuelle du 07/09/2026).
        sand: {
          100: '#f3ead9',
          200: '#e8ddc7',
        },
      },
      fontFamily: {
        // Refonte visuelle du 07/09/2026 : Public Sans remplace Inter pour
        // le corps de texte, Lora habille les titres desktop (voir la règle
        // h1-h2 dans index.css), Playfair Display les entêtes mobile —
        // toutes auto-hébergées, pas de CDN tiers. Remplace l'ancienne
        // identité mobile Fredoka/Nunito de la coquille "Wow / Aurora"
        // (retirée le 07/09/2026, plus aucun usage dans le code).
        sans: ['Public Sans', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'serif'],
        playfair: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        // Reprises telles quelles de l'aperçu "Wow / Aurora" validé par la cliente.
        'mesh-drift': {
          '0%':   { backgroundPosition: '10% 20%, 90% 10%, 55% 85%, 15% 90%, 0% 0%' },
          '100%': { backgroundPosition: '30% 35%, 70% 25%, 35% 65%, 30% 75%, 0% 0%' },
        },
        'cat-bob': {
          '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' },
          '50%':      { transform: 'translateY(-7px) rotate(-1deg)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '.2', transform: 'scale(.7) rotate(0deg)' },
          '50%':      { opacity: '1', transform: 'scale(1.15) rotate(15deg)' },
        },
        'fab-pulse': {
          '0%, 100%': { boxShadow: '0 8px 18px -4px rgba(217,103,11,.55)' },
          '50%':      { boxShadow: '0 8px 26px -2px rgba(217,103,11,.85), 0 0 0 7px rgba(242,130,15,.14)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // Micro-interactions du 08/09/2026 (retour d'Anaïs sur l'aperçu
        // d'animations) : favori qui "pop" au clic, pastille de
        // notification qui pulse, glissement d'un message de confirmation.
        pop: {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        // Amplitude douce (pas comme la pastille sans chiffre de l'aperçu) :
        // ce badge affiche toujours un nombre, une pulsation trop marquée
        // le rendrait illisible en mouvement.
        'badge-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(1.12)', opacity: '.85' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'mesh-drift': 'mesh-drift 16s ease-in-out infinite alternate',
        'cat-bob': 'cat-bob 3.4s ease-in-out infinite',
        twinkle: 'twinkle 2.6s ease-in-out infinite',
        'fab-pulse': 'fab-pulse 2.4s ease-in-out infinite',
        'rise-in': 'rise-in .55s ease-out both',
        pop: 'pop .35s ease-out',
        'badge-pulse': 'badge-pulse 1.6s ease-in-out infinite',
        'toast-in': 'toast-in .25s ease-out both',
      },
    },
  },
  plugins: [],
}
