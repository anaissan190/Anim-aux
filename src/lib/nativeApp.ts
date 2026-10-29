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

// Adresse vers laquelle l'email ramène l'utilisateur : toujours une page du site
// (elle marche sur ordinateur comme sur téléphone). Depuis l'application, « ?from=app »
// fait proposer, sur téléphone, d'ouvrir l'application (OpenInAppBanner).
export function authRedirectUrl(path: string, native: boolean = isNativeApp()): string {
  const clean = path.replace(/^\//, '')
  return native ? `${WEB_ORIGIN}/${clean}?from=app` : `${window.location.origin}/${clean}`
}

export function isMobileBrowser(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(userAgent)
}

// Lien qui rouvre l'application avec les jetons du lien d'email (lus par DeepLinkHandler).
export function openInAppUrl(path: string, hash: string): string {
  return `${NATIVE_SCHEME}${path.replace(/^\//, '')}${hash}`
}

// Proposer « Ouvrir l'application » seulement si : lien venu de l'application,
// navigateur de téléphone, et lien d'email réellement porteur d'un jeton ou d'une erreur.
export function shouldOfferOpenInApp(o: { search: string; hash: string; userAgent: string; native: boolean }): boolean {
  if (o.native) return false
  if (new URLSearchParams(o.search).get('from') !== 'app') return false
  if (!isMobileBrowser(o.userAgent)) return false
  return o.hash.includes('access_token=') || o.hash.includes('error=')
}

// Les règles d'Apple et de Google interdisent, dans une application des stores, les boutons, liens et
// appels à l'action qui mènent à un autre moyen de paiement que le leur (sauf programmes spéciaux selon
// le pays). L'abonnement des praticiens se prend sur le site : dans l'application, aucun écran de
// tarification ni de paiement, aucun bouton « Passer à l'abonnement ». Le site, lui, reste inchangé.
export function canSellSubscriptions(native: boolean = isNativeApp()): boolean {
  return !native
}
