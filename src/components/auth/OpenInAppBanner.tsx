// src/components/auth/OpenInAppBanner.tsx
// Page ouverte depuis l'email d'un compte créé dans l'application, sur un téléphone :
// propose de rouvrir l'application avec le même lien. Rien ne s'affiche ailleurs
// (ordinateur, inscription faite sur le web) : le site continue de fonctionner seul.
import { initialUrlHash } from '@/lib/supabase'
import { isNativeApp, openInAppUrl, shouldOfferOpenInApp } from '@/lib/nativeApp'

export default function OpenInAppBanner({ path }: { path: 'auth' | 'reset-password' }) {
  const offer = shouldOfferOpenInApp({
    search: window.location.search,
    hash: initialUrlHash,
    userAgent: navigator.userAgent,
    native: isNativeApp(),
  })
  if (!offer) return null

  return (
    <a href={openInAppUrl(path, initialUrlHash)} className="btn-primary block text-center w-full mb-4">
      Ouvrir dans l'application Animéaux
    </a>
  )
}
