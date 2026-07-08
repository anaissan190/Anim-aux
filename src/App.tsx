import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'

import LandingPage from '@/pages/LandingPage'
import SearchPage from '@/pages/SearchPage'
import DoctorPage from '@/pages/DoctorPage'
import BookPage from '@/pages/BookPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPassword from '@/pages/ForgotPassword'
import PatientDashboard from '@/pages/PatientDashboard'
import DoctorDashboard from '@/pages/DoctorDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import MessagesPage from '@/pages/MessagesPage'
import AnimalHealthPage from '@/pages/AnimalHealthPage'
import ProfilPage from '@/pages/ProfilPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LogoPreview from '@/pages/LogoPreview'

export default function App() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const fallbackUser = { id: session.user.id, email: session.user.email!, role: 'patient' as const, created_at: '' }
          try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
            const rpcCall = supabase.rpc('get_my_user_data')
            const { data, error } = (await Promise.race([rpcCall, timeout])) as Awaited<typeof rpcCall>

            if (error || !data) {
              setUser(fallbackUser)
              setProfile(null)
            } else {
              setUser({ ...fallbackUser, role: data.role ?? 'patient' })
              setProfile(data.profile ?? null)
            }
          } catch {
            // Timeout ou RPC indisponible : on ne bloque jamais l'utilisateur
            setUser(fallbackUser)
            setProfile(null)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/doctor/:id" element={<DoctorPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/book/:doctorId" element={
          <ProtectedRoute role="patient"><BookPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/patient" element={
          <ProtectedRoute role="patient"><PatientDashboard /></ProtectedRoute>
        } />
        <Route path="/dashboard/doctor" element={
          <ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>
        } />
        <Route path="/dashboard/admin" element={
          <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute><MessagesPage /></ProtectedRoute>
        } />
        <Route path="/animal/:id" element={
          <ProtectedRoute role="patient"><AnimalHealthPage /></ProtectedRoute>
        } />
        <Route path="/profil" element={
          <ProtectedRoute><ProfilPage /></ProtectedRoute>
        } />
        <Route path="/logo-preview" element={<LogoPreview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
