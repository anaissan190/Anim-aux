import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import type { UserRole } from '@/types'

interface Props { children: React.ReactNode; role?: UserRole | UserRole[] }

export default function ProtectedRoute({ children, role }: Props) {
  const { user } = useAuthStore()
  const location = useLocation()
  // Retenu dans l'URL de /login pour y revenir après connexion (ex. lien
  // "Voir mes rendez-vous" reçu par email, ouvert sans session active) —
  // voir LoginPage.tsx qui lit ce même paramètre "redirect".
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  const allowedRoles = role ? (Array.isArray(role) ? role : [role]) : null
  if (allowedRoles && !allowedRoles.includes(user.role) && !user.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}
