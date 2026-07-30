import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest plutôt que generateSW (par défaut) : le service worker
      // auto-généré ne peut pas recevoir de gestionnaires custom (push,
      // notificationclick) — on fournit donc notre propre src/sw.ts, dans
      // lequel le plugin injecte juste la liste de précache Workbox.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Animéaux',
        short_name: 'Animéaux',
        description: "Trouvez un praticien du secteur animalier et prenez rendez-vous en ligne",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#F2820F',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      injectManifest: {
        // Précache l'app shell (JS/CSS/HTML/icônes) pour un démarrage
        // hors-ligne minimal — les données restent dépendantes du réseau
        // (Supabase), seule l'interface se charge sans connexion.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  build: {
    rollupOptions: {
      output: {
        // Sépare les grosses libs tierces (rarement modifiées) du code
        // applicatif (modifié à chaque déploiement) : le navigateur d'un
        // visiteur qui revient peut réutiliser ces chunks en cache même
        // après une mise à jour de l'app, au lieu de tout retélécharger.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true // permet l'accès depuis le téléphone sur le réseau local
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
