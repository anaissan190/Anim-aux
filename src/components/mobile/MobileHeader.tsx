// src/components/mobile/MobileHeader.tsx
// Bandeau du haut de la coquille mobile (refonte "Wow / Aurora") : cloche de
// notifications + avatar profil, sur un fond dont la teinte est fournie par
// chaque page (héro coloré sur l'Accueil, fond plus doux ailleurs). Pas de
// logo ici — retiré volontairement (retour cliente) pour laisser toute la
// place au contenu de chaque écran.
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import NotificationBell from '@/components/ui/NotificationBell'
import { useAuthStore } from '@/lib/authStore'

type Props = {
  className?: string
  children?: ReactNode
}

export default function MobileHeader({ className = '', children }: Props) {
  const { profile } = useAuthStore()

  return (
    <div className={`relative px-4 pt-3 pb-4 ${className}`}>
      <div className="flex items-center justify-end gap-2 mb-2">
        <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center [&_button]:p-0">
          <NotificationBell />
        </div>
        <Link to="/profil"
          className="w-9 h-9 rounded-full bg-sage-100 border border-white/70 shadow-sm flex items-center justify-center overflow-hidden text-base flex-shrink-0">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Mon profil" />
            : '👤'}
        </Link>
      </div>
      {children}
    </div>
  )
}
