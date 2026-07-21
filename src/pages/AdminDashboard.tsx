// src/pages/AdminDashboard.tsx
import { useState } from 'react'
import Navbar from '@/components/ui/Navbar'
import { useAdminPendingDoctors, useAdminReviewDoctor } from '@/hooks/useData'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function AdminDashboard() {
  const { data: pendingDoctors = [], isLoading } = useAdminPendingDoctors()
  const reviewDoctor = useAdminReviewDoctor()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
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

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Administration</h1>
        <p className="text-sm text-gray-500 mb-6">
          Réservé aux administrateurs. Pour toute autre opération (utilisateurs, données), utilisez directement le
          tableau de bord Supabase.
        </p>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              Praticiens en attente de vérification
              {pendingDoctors.length > 0 && (
                <span className="badge bg-amber-100 text-amber-700 ml-2">{pendingDoctors.length}</span>
              )}
            </h2>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : pendingDoctors.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun praticien en attente pour l&apos;instant.</p>
          ) : (
            <div className="space-y-4">
              {pendingDoctors.map((d: any) => (
                <div key={d.doctor_id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{d.first_name} {d.last_name}</p>
                      <p className="text-xs text-gray-500">{d.specialty} · {d.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Inscrit {format(new Date(d.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>

                  {d.documents.length === 0 ? (
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
                      <button onClick={() => handleApprove(d.doctor_id)} disabled={reviewDoctor.isPending}
                        className="btn-primary text-sm px-4 py-2">
                        ✓ Valider
                      </button>
                      <button onClick={() => setRejectingId(d.doctor_id)} disabled={reviewDoctor.isPending}
                        className="btn-secondary text-sm px-4 py-2 text-red-500">
                        ✕ Rejeter
                      </button>
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
