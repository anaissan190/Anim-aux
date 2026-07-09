// src/components/appointment/AppointmentCard.tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { useUpdateAppointmentStatus, useCreateReview } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import type { Appointment, AppointmentStatus } from '@/types'

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending:   'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
}
const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  pending:   'badge-yellow',
  confirmed: 'badge-green',
  cancelled: 'badge-red',
  completed: 'badge-gray',
}

interface Props {
  appointment: Appointment
  showPatient?: boolean
}

export default function AppointmentCard({ appointment, showPatient }: Props) {
  const { user } = useAuthStore()
  const update = useUpdateAppointmentStatus()
  const createReview = useCreateReview()
  const start = new Date(appointment.start_at)

  const [showReviewForm, setShowReviewForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const existingReview = appointment.reviews?.[0]

  async function submitReview() {
    setReviewError('')
    try {
      await createReview.mutateAsync({
        appointmentId: appointment.id,
        doctorId: appointment.doctor_id,
        rating,
        comment: comment.trim() || undefined,
      })
      setShowReviewForm(false)
    } catch (e: any) {
      setReviewError(e.message ?? "Erreur lors de l'envoi de l'avis.")
    }
  }

  const name = showPatient
    ? `${appointment.profiles?.first_name ?? ''} ${appointment.profiles?.last_name ?? ''}`
    : `${(appointment.doctors as any)?.profiles?.first_name ?? ''} ${(appointment.doctors as any)?.profiles?.last_name ?? ''}`

  const canCancel =
    ['pending', 'confirmed'].includes(appointment.status) &&
    new Date(appointment.start_at) > new Date()

  return (
    <div className="card p-4 flex items-start gap-4">
      {/* Date bloc */}
      <div className="flex-shrink-0 w-14 text-center bg-sage-50 rounded-xl py-2">
        <p className="text-xs text-sage-600 font-medium uppercase">{format(start, 'MMM', { locale: fr })}</p>
        <p className="text-2xl font-bold text-sage-700 leading-none">{format(start, 'd')}</p>
        <p className="text-xs text-gray-500 mt-0.5">{format(start, 'HH:mm')}</p>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 truncate">{name || 'Praticien'}</p>
            <p className="text-sm text-sage-600">{(appointment.doctors as any)?.specialty ?? ''}</p>
            {appointment.reason && (
              <p className="text-xs text-gray-500 mt-1 truncate">Motif : {appointment.reason}</p>
            )}
            {showPatient && appointment.animals && ['confirmed', 'completed'].includes(appointment.status) && (
              <Link to={`/animal/${appointment.animals.id}`}
                className="inline-flex items-center gap-1 text-xs text-sage-600 hover:underline mt-1">
                🐾 Dossier de {appointment.animals.name}
              </Link>
            )}

            {/* Avis (patient uniquement, RDV terminé) */}
            {!showPatient && appointment.status === 'completed' && (
              existingReview ? (
                <p className="text-xs text-amber-500 mt-1">
                  {'★'.repeat(existingReview.rating)}{'☆'.repeat(5 - existingReview.rating)} Avis envoyé
                </p>
              ) : !showReviewForm ? (
                <button onClick={() => setShowReviewForm(true)} className="text-xs text-sage-600 hover:underline mt-1">
                  ⭐ Laisser un avis
                </button>
              ) : (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl">
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setRating(n)}
                        className={`text-lg leading-none ${n <= rating ? 'text-amber-400' : 'text-gray-300'}`}>
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    className="input text-sm resize-none" rows={2}
                    placeholder="Votre commentaire (facultatif)..." />
                  {reviewError && <p className="text-red-500 text-xs mt-1">{reviewError}</p>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={submitReview} disabled={createReview.isPending} className="btn-primary text-xs px-3 py-1.5">
                      {createReview.isPending ? 'Envoi...' : 'Envoyer'}
                    </button>
                    <button onClick={() => setShowReviewForm(false)} className="btn-secondary text-xs px-3 py-1.5">Annuler</button>
                  </div>
                </div>
              )
            )}
          </div>
          <span className={STATUS_CLASSES[appointment.status]}>
            {STATUS_LABELS[appointment.status]}
          </span>
        </div>
      </div>

      {/* Actions */}
      {canCancel && (
        <button
          onClick={() => update.mutate({ id: appointment.id, status: 'cancelled' })}
          disabled={update.isPending}
          className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors font-medium">
          Annuler
        </button>
      )}
      {user?.role === 'doctor' && appointment.status === 'pending' && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => update.mutate({ id: appointment.id, status: 'confirmed' })}
            className="text-xs btn-primary py-1 px-3">
            Confirmer
          </button>
          <button
            onClick={() => update.mutate({ id: appointment.id, status: 'cancelled' })}
            className="text-xs btn-secondary py-1 px-3">
            Refuser
          </button>
        </div>
      )}
    </div>
  )
}
