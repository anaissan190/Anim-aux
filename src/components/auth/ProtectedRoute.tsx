import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import type { UserRole } from '@/types'

interface Props { children: React.ReactNode; role?: UserRole }

export default function ProtectedRoute({ children, role }: Props) {
  const { user, loading } = useAuthStore()

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '32px', color: '#C2410C' }}>Animéaux 🐾</div>
      <div style={{ fontSize: '14px', color: '#92400E', fontFamily: 'Nunito, sans-serif' }}>Chargement...</div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}