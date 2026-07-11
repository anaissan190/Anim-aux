import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, getMyUserDataWithRetry } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'

import LandingPage from '@/pages/LandingPage'
import SearchPage from '@/pages/SearchPage'
import DoctorPage from '@/pages/DoctorPage'
import BookPage from '@/pages/BookPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import PatientDashboard from '@/pages/PatientDashboard'
import DoctorDashboard from '@/pages/DoctorDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import MessagesPage from '@/pages/MessagesPage'
import AnimalHealthPage from '@/pages/AnimalHealthPage'
import PatientDocumentsPage from '@/pages/PatientDocumentsPage'
import ProfilPage from '@/pages/ProfilPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LogoPreview from '@/pages/LogoPreview'

export default function App() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ne relance l'appel RPC (get_my_user_data, jusqu'à 3 tentatives x 8s)
        // qu'à la connexion/déconnexion réelle — pas à chaque TOKEN_REFRESHED,
        // que Supabase émet régulièrement (y compris au retour sur l'onglet).
        // Sans ce filtre, ça déclenche une requête réseau en fond à chaque
        // focus/refresh de token, qui vient ralentir tout le reste (chaque
        // page semble mettre du temps à charger / données qui tardent).
        if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') return

        if (session?.user) {
          const fallbackUser = { id: session.user.id, email: session.user.email!, role: 'patient' as const, created_at: '' }
          const data = await getMyUserDataWithRetry()
          if (data) {
            setUser({ ...fallbackUser, role: data.role ?? 'patient' })
            setProfile(data.profile ?? null)
          } else {
            // Timeout ou RPC indisponible même après retry : on ne bloque jamais l'utilisateur
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
        <Route path="/reset-password" element={<ResetPassword />} />
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
          <ProtectedRoute role={['patient', 'doctor']}><AnimalHealthPage /></ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute role="patient"><PatientDocumentsPage /></ProtectedRoute>
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
