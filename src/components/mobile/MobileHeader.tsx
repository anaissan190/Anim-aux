// src/components/mobile/MobileHeader.tsx
// Bandeau du haut de la coquille mobile (refonte "Wow / Aurora") : cloche de
// notifications + accès messages, sur un fond dont la teinte est fournie par
// chaque page (héro coloré sur l'Accueil, fond plus doux ailleurs). Pas de
// logo ici — retiré volontairement (retour cliente) pour laisser toute la
// place au contenu de chaque écran. Le profil n'est plus ici : il a migré
// vers la barre d'onglets du bas (en bas à droite), à la place de Messages,
// qui a pris ce coin — arbitrage validé en aperçu (option 1).
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import NotificationBell from '@/components/ui/NotificationBell'
import { useConversationPartners } from '@/hooks/useData'

type Props = {
  className?: string
  children?: ReactNode
}

export default function MobileHeader({ className = '', children }: Props) {
  const { data: conversationPartners = [] } = useConversationPartners()
  const unreadMessages = conversationPartners.reduce((sum, p) => sum + (p.unread_count || 0), 0)

  return (
    <div className={`relative px-4 pt-3 pb-4 ${className}`}>
      <div className="flex items-center justify-end gap-2 mb-2">
        <div className="w-[38px] h-[38px] rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center [&_button]:p-0">
          <NotificationBell large />
        </div>
        <Link to="/messages"
          className="relative w-[38px] h-[38px] rounded-full bg-white/90 backdrop-blur-sm border border-white/70 shadow-sm flex items-center justify-center text-lg flex-shrink-0">
          💬
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-[15px] h-[15px] bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-medium">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </Link>
      </div>
      {children}
    </div>
  )
}
