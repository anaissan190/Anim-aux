// src/pages/AdminDashboard.tsx
import Navbar from '@/components/ui/Navbar'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Administration</h1>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Utilisateurs', value: '—', icon: '👥' },
            { label: 'Praticiens', value: '—', icon: '🩺' },
            { label: 'RDV ce mois', value: '—', icon: '📅' },
          ].map(m => (
            <div key={m.label} className="card p-5 text-center">
              <div className="text-3xl mb-2">{m.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{m.value}</p>
              <p className="text-xs text-gray-500 mt-1">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Praticiens à vérifier</h2>
          <p className="text-sm text-gray-500">
            Les praticiens en attente de validation apparaîtront ici.
            Connectez-vous à <a href="https://app.supabase.com" className="text-sage-600 underline" target="_blank" rel="noreferrer">Supabase</a> pour gérer les données directement pendant la phase de test.
          </p>
        </div>
      </div>
    </div>
  )
}
