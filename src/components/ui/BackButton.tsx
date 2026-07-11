// src/components/ui/BackButton.tsx
import { useNavigate, useLocation } from 'react-router-dom'

// Bouton "retour" générique pour les pages atteintes en cliquant depuis une
// autre page (fiche praticien, dossier animal, réservation, profil...).
// Revient dans l'historique du navigateur (préserve l'onglet/le contexte
// d'origine, ex: "Mes patients" plutôt que l'accueil du dashboard). Si la
// page a été ouverte directement (lien partagé, nouvel onglet, rafraîchissement
// sans historique), il n'y a rien dans l'historique vers quoi revenir :
// `location.key === 'default'` le détecte, et on retombe alors sur `fallback`.
export default function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(fallback)
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-sage-600 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4 transition-colors"
    >
      <span aria-hidden="true">←</span> Retour
    </button>
  )
}
