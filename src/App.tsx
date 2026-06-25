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
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LogoPreview from '@/pages/LogoPreview'

export default function App() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single()

          setUser(userData ?? { id: session.user.id, email: session.user.email!, role: 'patient', created_at: '' })
          setProfile(profileData ?? null)
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
        <Route path="/logo-preview" element={<LogoPreview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
