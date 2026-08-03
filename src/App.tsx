import { useEffect, useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, getMyUserDataWithRetry } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import SplashScreen from '@/components/ui/SplashScreen'

// Chaque page est chargée à la demande (React.lazy) plutôt qu'incluse dans le
// bundle principal : sans ça, un visiteur qui arrive sur la page de connexion
// téléchargeait aussi tout le code du dashboard praticien, de l'admin, des
// statistiques, etc. ProtectedRoute reste en import statique (composant très
// léger utilisé par la quasi-totalité des routes protégées).
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const DoctorPage = lazy(() => import('@/pages/DoctorPage'))
const ClinicPage = lazy(() => import('@/pages/ClinicPage'))
const BookPage = lazy(() => import('@/pages/BookPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const PatientDashboard = lazy(() => import('@/pages/PatientDashboard'))
const DoctorDashboard = lazy(() => import('@/pages/DoctorDashboard'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))
const SecretaryDashboard = lazy(() => import('@/pages/SecretaryDashboard'))
const MessagesPage = lazy(() => import('@/pages/MessagesPage'))
const AnimalHealthPage = lazy(() => import('@/pages/AnimalHealthPage'))
const AnimalRecordExportPage = lazy(() => import('@/pages/AnimalRecordExportPage'))
const PatientDocumentsPage = lazy(() => import('@/pages/PatientDocumentsPage'))
const RemindersPage = lazy(() => import('@/pages/RemindersPage'))
const AnimalsPage = lazy(() => import('@/pages/AnimalsPage'))
const RendezVousPage = lazy(() => import('@/pages/RendezVousPage'))
const ProfilPage = lazy(() => import('@/pages/ProfilPage'))
const LogoPreview = lazy(() => import('@/pages/LogoPreview'))
const LegalPage = lazy(() => import('@/pages/LegalPage'))
import ProtectedRoute from '@/components/auth/ProtectedRoute'

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-sage-200 border-t-sage-500 rounded-full animate-spin" />
    </div>
  )
}

// "/" : un compte déjà connecté doit arriver directement sur son propre
// espace (celui qu'on a conçu pour lui), jamais sur la page vitrine
// publique — surtout sensible pour l'icône ajoutée à l'écran d'accueil,
// dont le raccourci pointe toujours vers "/".
function HomeRoute() {
  const { user } = useAuthStore()
  if (user) {
    const dashboardPath =
      user.role === 'doctor'    ? '/dashboard/doctor' :
      user.role === 'secretary' ? '/dashboard/secretariat' :
      '/dashboard/patient'
    return <Navigate to={dashboardPath} replace />
  }
  return <LandingPage />
}

export default function App() {
  const { loading, setUser, setProfile, setLoading } = useAuthStore()
  // Durée plancher pour l'écran de démarrage : sans ça, sur une session déjà
  // connue (réhydratée depuis le stockage local), l'écran de chargement
  // n'apparaîtrait qu'une fraction de seconde — un flash plus qu'un vrai
  // écran de lancement façon appli native.
  const [splashElapsed, setSplashElapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), 600)
    return () => clearTimeout(t)
  }, [])

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
          const fallbackUser = { id: session.user.id, email: session.user.email!, role: 'patient' as const, is_admin: false, created_at: '' }
          const data = await getMyUserDataWithRetry()
          if (data?.is_suspended) {
            // Compte suspendu par un admin : on refuse la session même si le
            // token était encore valide (ex. onglet resté ouvert depuis avant
            // la suspension) — jamais bloqué côté fallback réseau, seulement
            // quand la RPC confirme explicitement is_suspended.
            await supabase.auth.signOut()
            setUser(null)
            setProfile(null)
            setLoading(false)
            window.location.href = `/login?suspended=1${data.suspended_reason ? `&reason=${encodeURIComponent(data.suspended_reason)}` : ''}`
            return
          }
          if (data) {
            setUser({ ...fallbackUser, role: data.role ?? 'patient', is_admin: data.is_admin ?? false })
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

  if (loading || !splashElapsed) return <SplashScreen />

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/doctor/:id" element={<DoctorPage />} />
        <Route path="/cabinet/:id" element={<ClinicPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/cgu" element={<LegalPage />} />
        <Route path="/confidentialite" element={<LegalPage />} />
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
        {/* L'espace secrétariat est un compte à part entière (role
            'secretary'), jamais un accès ajouté à un compte praticien ou
            patient existant — dashboard parallèle avec ses propres
            identifiants (voir invite-clinic-secretary). */}
        <Route path="/dashboard/secretariat" element={
          <ProtectedRoute role="secretary"><SecretaryDashboard /></ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute><MessagesPage /></ProtectedRoute>
        } />
        <Route path="/animal/:id" element={
          <ProtectedRoute role={['patient', 'doctor']}><AnimalHealthPage /></ProtectedRoute>
        } />
        <Route path="/animal/:id/carnet" element={
          <ProtectedRoute role={['patient', 'doctor']}><AnimalRecordExportPage /></ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute role="patient"><PatientDocumentsPage /></ProtectedRoute>
        } />
        <Route path="/rappels" element={
          <ProtectedRoute role="patient"><RemindersPage /></ProtectedRoute>
        } />
        {/* Destinations de la barre de navigation mobile (MobileTabBar) —
            contenu extrait de PatientDashboard, jusqu'ici uniquement intégré
            à l'Accueil (voir refonte "Wow / Aurora"). */}
        <Route path="/animaux" element={
          <ProtectedRoute role="patient"><AnimalsPage /></ProtectedRoute>
        } />
        <Route path="/rendez-vous" element={
          <ProtectedRoute role="patient"><RendezVousPage /></ProtectedRoute>
        } />
        <Route path="/profil" element={
          <ProtectedRoute><ProfilPage /></ProtectedRoute>
        } />
        <Route path="/logo-preview" element={<LogoPreview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
