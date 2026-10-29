// src/pages/AuthConfirmPage.tsx
// Destination du lien de confirmation d'inscription pour un compte créé dans
// l'application : sur ordinateur le compte est confirmé ici même (Supabase ouvre
// la session via le lien), sur téléphone on propose aussi d'ouvrir l'application.
import { Link } from 'react-router-dom'
import logoNavbar from '@/assets/logo-navbar.webp'
import OpenInAppBanner from '@/components/auth/OpenInAppBanner'
import { initialUrlHash } from '@/lib/supabase'

export default function AuthConfirmPage() {
  // Un lien d'email valide arrive toujours avec un jeton ; sans lui (adresse ouverte à la main, lien expiré), on ne dit pas « confirmé ».
  const invalid = !initialUrlHash.includes('access_token=')

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex"><img src={logoNavbar} alt="Animéaux" className="h-10 w-auto" /></Link>
        </div>
        <div className="card p-8 text-center">
          {invalid ? (
            <>
              <div className="text-4xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Ce lien n'est plus valide</h1>
              <p className="text-sm text-gray-500 mb-6">
                Il a peut-être expiré. Connectez-vous : si votre compte n'est pas encore confirmé, vous pourrez demander un nouvel email.
              </p>
              <Link to="/login" className="btn-primary inline-block">Aller à la connexion</Link>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Votre compte est confirmé</h1>
              <p className="text-sm text-gray-500 mb-6">
                Vous pouvez continuer ici, ou retourner dans l'application et vous y connecter.
              </p>
              <OpenInAppBanner path="auth" />
              <Link to="/" className="btn-secondary inline-block w-full">Continuer sur le site</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
