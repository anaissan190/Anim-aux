// src/pages/AdminDashboard.tsx
import { useState } from 'react'
import Navbar from '@/components/ui/Navbar'
import {
  useAdminPendingDoctors, useAdminReviewDoctor, useAdminPlatformStats, useAdminDoctorsByStatus,
} from '@/hooks/useData'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Tab = 'pending' | 'verified' | 'rejected'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge bg-amber-100 text-amber-700',
  verified: 'badge bg-green-100 text-green-700',
  rejected: 'badge bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', verified: 'Vérifié', rejected: 'Rejeté',
}

export default function AdminDashboard() {
  const { data: stats } = useAdminPlatformStats()
  const [tab, setTab] = useState<Tab>('pending')

  const { data: pendingDoctors = [], isLoading: pendingLoading } = useAdminPendingDoctors()
  const { data: verifiedDoctors = [], isLoading: verifiedLoading } = useAdminDoctorsByStatus(tab === 'verified' ? 'verified' : null)
  const { data: rejectedDoctors = [], isLoading: rejectedLoading } = useAdminDoctorsByStatus(tab === 'rejected' ? 'rejected' : null)

  const reviewDoctor = useAdminReviewDoctor()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  async function handleApprove(doctorId: string) {
    setError('')
    try {
      await reviewDoctor.mutateAsync({ doctorId, approve: true })
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la validation.')
    }
  }

  async function handleReject(doctorId: string) {
    setError('')
    try {
      await reviewDoctor.mutateAsync({ doctorId, approve: false, reason: rejectReason.trim() || undefined })
      setRejectingId(null)
      setRejectReason('')
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du rejet.')
    }
  }

  const activeList = tab === 'pending' ? pendingDoctors : tab === 'verified' ? verifiedDoctors : rejectedDoctors
  const activeLoading = tab === 'pending' ? pendingLoading : tab === 'verified' ? verifiedLoading : rejectedLoading
  const filteredList = search.trim()
    ? activeList.filter((d: any) => {
        const q = search.trim().toLowerCase()
        return `${d.first_name} ${d.last_name}`.toLowerCase().includes(q)
          || d.email?.toLowerCase().includes(q)
          || d.specialty?.toLowerCase().includes(q)
      })
    : activeList

  const statCards = stats ? [
    { label: 'Propriétaires', value: stats.patients_count, icon: '🙋' },
    { label: 'Praticiens vérifiés', value: stats.doctors_verified, icon: '✅' },
    { label: 'Praticiens en attente', value: stats.doctors_pending, icon: '⏳' },
    { label: 'Praticiens rejetés', value: stats.doctors_rejected, icon: '⛔' },
    { label: 'Secrétariats', value: stats.secretaries_count, icon: '🏥' },
    { label: 'Cabinets', value: stats.clinics_count, icon: '🏢' },
    { label: 'RDV à venir', value: stats.appointments_upcoming, icon: '🗓️' },
    { label: 'RDV au total', value: stats.appointments_total, icon: '📋' },
    { label: 'Avis publiés', value: stats.reviews_count, icon: '⭐' },
  ] : []

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Administration</h1>
        <p className="text-sm text-gray-500 mb-6">
          Vue d'ensemble de la plateforme et vérification des praticiens.
        </p>

        {/* Vue d'ensemble */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {statCards.map(c => (
            <div key={c.label} className="card p-4">
              <div className="text-xl mb-1">{c.icon}</div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Dossiers praticiens */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
              {(['pending', 'verified', 'rejected'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); setSearch('') }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5
                    ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {STATUS_LABEL[t]}
                  {t === 'pending' && pendingDoctors.length > 0 && (
                    <span className="badge bg-amber-100 text-amber-700">{pendingDoctors.length}</span>
                  )}
                </button>
              ))}
            </div>
            {tab !== 'pending' && (
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email, spécialité..."
                className="input text-sm max-w-xs" />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {activeLoading ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : filteredList.length === 0 ? (
            <p className="text-sm text-gray-400">
              {search.trim() ? 'Aucun résultat pour cette recherche.' : `Aucun dossier "${STATUS_LABEL[tab].toLowerCase()}" pour l'instant.`}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredList.map((d: any) => (
                <div key={d.doctor_id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{d.first_name} {d.last_name}</p>
                        {d.verification_status && d.verification_status !== 'pending' && (
                          <span className={STATUS_BADGE[d.verification_status]}>{STATUS_LABEL[d.verification_status]}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {d.specialty} · {d.email}{d.city ? ` · ${d.city}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Inscrit {format(new Date(d.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        {typeof d.review_count === 'number' && d.review_count > 0 && (
                          <> · ⭐ {d.average_rating} ({d.review_count} avis)</>
                        )}
                      </p>
                      {d.verification_rejected_reason && (
                        <p className="text-xs text-red-500 mt-1">Motif du rejet : {d.verification_rejected_reason}</p>
                      )}
                    </div>
                  </div>

                  {(!d.documents || d.documents.length === 0) ? (
                    <p className="text-xs text-amber-600 mb-3">Aucun document déposé pour l&apos;instant.</p>
                  ) : (
                    <ul className="space-y-1.5 mb-3">
                      {d.documents.map((doc: any) => (
                        <li key={doc.id}>
                          <a href={doc.file_url} target="_blank" rel="noreferrer"
                            className="text-sm text-sage-600 hover:underline">
                            📄 {doc.document_type} — {doc.file_name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  {rejectingId === d.doctor_id ? (
                    <div className="space-y-2">
                      <input className="input text-sm" placeholder="Motif du rejet (optionnel, visible par le praticien)"
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(d.doctor_id)} disabled={reviewDoctor.isPending}
                          className="btn-primary bg-red-500 hover:bg-red-600 text-sm px-4 py-2">
                          Confirmer le rejet
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                          className="btn-secondary text-sm px-4 py-2">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {tab !== 'verified' && (
                        <button onClick={() => handleApprove(d.doctor_id)} disabled={reviewDoctor.isPending}
                          className="btn-primary text-sm px-4 py-2">
                          ✓ Valider
                        </button>
                      )}
                      {tab !== 'rejected' && (
                        <button onClick={() => setRejectingId(d.doctor_id)} disabled={reviewDoctor.isPending}
                          className="btn-secondary text-sm px-4 py-2 text-red-500">
                          ✕ Rejeter
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
