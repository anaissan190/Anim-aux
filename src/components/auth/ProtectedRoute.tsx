import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import type { UserRole } from '@/types'

interface Props { children: React.ReactNode; role?: UserRole | UserRole[] }

export default function ProtectedRoute({ children, role }: Props) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  const allowedRoles = role ? (Array.isArray(role) ? role : [role]) : null
  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
