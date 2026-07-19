// src/components/ui/Footer.tsx
import { Link } from 'react-router-dom'
import logoNavbar from '@/assets/logo-navbar.svg'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-3 gap-10">
          <div>
            <img src={logoNavbar} alt="Animéaux" className="h-8 w-auto mb-3" />
            <p className="text-sm text-gray-500 leading-relaxed">
              La plateforme qui met en relation propriétaires d'animaux et praticiens du secteur animalier.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Découvrir</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/search" className="hover:text-sage-600 transition-colors">Rechercher un praticien</Link></li>
              <li><Link to="/register?role=doctor" className="hover:text-sage-600 transition-colors">Rejoindre en tant que praticien</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Informations légales</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/cgu" className="hover:text-sage-600 transition-colors">Conditions Générales d'Utilisation</Link></li>
              <li><Link to="/confidentialite" className="hover:text-sage-600 transition-colors">Politique de confidentialité</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400">
          © {new Date().getFullYear()} Animéaux — Tous droits réservés
        </div>
      </div>
    </footer>
  )
}
