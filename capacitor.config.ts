import type { CapacitorConfig } from '@capacitor/cli'

// L'identifiant (appId) est DÉFINITIF une fois l'application publiée sur l'App Store / Google Play.
const config: CapacitorConfig = {
  appId: 'fr.monanimeaux.app',
  appName: 'Animéaux',
  webDir: 'dist',
  ios: {
    // Sans cela, le contenu passe sous l'heure et l'encoche de l'iPhone.
    contentInset: 'automatic',
    backgroundColor: '#FFFAF0',
  },
}

export default config
