// src/lib/nativeApp.ts
// Détection de l'application native (Capacitor) et adresses de retour des emails
// d'authentification. Dans l'application, window.location.origin vaut
// « capacitor://localhost » : un lien d'email construit dessus ne mènerait nulle part.
import { Capacitor } from '@capacitor/core'

export const WEB_ORIGIN = 'https://monanimeaux.fr'
export const NATIVE_SCHEME = 'fr.monanimeaux.app://'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

// Adresse vers laquelle l'email ramène l'utilisateur : le site sur le web
// (comportement inchangé), le schéma de l'application dans l'application.
export function authRedirectUrl(path: string, native: boolean = isNativeApp()): string {
  const clean = path.replace(/^\//, '')
  return native ? `${NATIVE_SCHEME}${clean}` : `${window.location.origin}/${clean}`
}
