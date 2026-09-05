// src/components/appointment/AppointmentCard.tsx
import { useState } from 'react'
import { format, differenceInMinutes, addMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { useUpdateAppointmentStatus, useRescheduleAppointment, useAppointmentDocuments } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { generateAppointmentIcs } from '@/lib/ics'
import AvailabilityCalendar from '@/components/appointment/AvailabilityCalendar'
import type { Appointment, AppointmentStatus } from '@/types'

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending:   'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
  no_show:   'Absent(e)',
}
const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  pending:   'badge-yellow',
  confirmed: 'badge-green',
  cancelled: 'badge-red',
  completed: 'badge-gray',
  no_show:   'badge-red',
}

interface Props {
  appointment: Appointment
  showPatient?: boolean
}

export default function AppointmentCard({ appointment, showPatient }: Props) {
  const { user } = useAuthStore()
  const update = useUpdateAppointmentStatus()
  const reschedule = useRescheduleAppointment()
  const { data: attachments = [] } = useAppointmentDocuments(appointment.id)
  const start = new Date(appointment.start_at)
  const [showReschedule, setShowReschedule] = useState(false)
  const [newSlot, setNewSlot] = useState<Date | null>(null)
  const [rescheduleError, setRescheduleError] = useState('')
  const [actionError, setActionError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [confirmingRefuse, setConfirmingRefuse] = useState(false)
  const [confirmingDoctorCancel, setConfirmingDoctorCancel] = useState(false)

  // Handler partagé pour Confirmer/Refuser/Terminé/Absent(e)/Annuler — sans
  // onError, un échec (ex. policy RLS qui bloque l'action) laissait le
  // bouton inerte sans le moindre message, l'utilisateur ne sachant jamais
  // si son clic avait eu un effet ou non.
  function handleStatusChange(status: AppointmentStatus) {
    setActionError('')
    update.mutate({ id: appointment.id, status }, {
      onError: (e: any) => setActionError(e instanceof Error ? e.message : "Erreur lors de l'action, réessaie."),
    })
  }

  const name = showPatient
    ? `${appointment.profiles?.first_name ?? ''} ${appointment.profiles?.last_name ?? ''}`
    : `${(appointment.doctors as any)?.profiles?.first_name ?? ''} ${(appointment.doctors as any)?.profiles?.last_name ?? ''}`

  // Bouton "Annuler" générique — patient uniquement. Un praticien a ses
  // propres actions dédiées (Refuser sur un RDV en attente, Terminé/Absent(e)
  // sur un RDV confirmé, plus bas) : sans ce filtre par rôle, les deux
  // jeux de boutons s'affichaient en même temps pour lui, redondants et
  // ambigus (deux façons différentes d'annuler le même RDV en attente).
  // Délai minimum d'1h avant le RDV (policy "appointments: patient peut
  // annuler le sien", migration 084) — plus souple que les 24h du report
  // ci-dessous, l'annulation reste possible en cas d'imprévu de dernière
  // minute.
  const canCancel =
    user?.role !== 'doctor' &&
    ['pending', 'confirmed'].includes(appointment.status) &&
    new Date(appointment.start_at).getTime() > Date.now() + 60 * 60 * 1000

  // Report par le patient lui-même (RLS : "appointments: patient peut
  // reporter le sien", migrations 083/085) — seulement sur un RDV déjà
  // confirmé, et à au moins 1h de l'heure du RDV, aligné sur le délai
  // d'annulation (même délai que côté base : sans ce garde-fou côté UI,
  // le bouton resterait cliquable mais l'update échouerait silencieusement
  // contre la policy RLS).
  const canReschedule =
    user?.role !== 'doctor' &&
    appointment.status === 'confirmed' &&
    new Date(appointment.start_at).getTime() > Date.now() + 60 * 60 * 1000

  function handleAddToCalendar() {
    const doctorProfile = (appointment.doctors as any)?.profiles
    const doctorName = doctorProfile
      ? `${doctorProfile.first_name ?? ''} ${doctorProfile.last_name ?? ''}`.trim()
      : 'votre praticien'
    const ics = generateAppointmentIcs({
      id: appointment.id,
      startAt: appointment.start_at,
      endAt: appointment.end_at,
      doctorName,
      specialty: (appointment.doctors as any)?.specialty,
      address: (appointment.doctors as any)?.address,
      city: (appointment.doctors as any)?.city,
      reason: appointment.reason,
    })
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rdv-animeaux-${appointment.id}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Durée d'origine préservée sur le nouveau créneau plutôt qu'une valeur
  // fixe : la réservation utilise 30 min par défaut, mais un RDV existant
  // peut avoir une durée différente selon la spécialité/tarif du praticien.
  const durationMinutes = differenceInMinutes(new Date(appointment.end_at), new Date(appointment.start_at))

  function handleConfirmReschedule() {
    if (!newSlot) return
    setRescheduleError('')
    reschedule.mutate(
      { id: appointment.id, start_at: newSlot.toISOString(), end_at: addMinutes(newSlot, durationMinutes).toISOString() },
      {
        onSuccess: () => { setShowReschedule(false); setNewSlot(null) },
        // Course possible entre l'affichage du créneau "libre" et la
        // confirmation : un autre RDV a pu le prendre entre-temps (index
        // unique partiel, migration 070) — sans ce message, le bouton
        // redevenait juste cliquable sans aucune explication.
        onError: (e: any) => {
          if (e?.code === '23505') setRescheduleError('Ce créneau vient d\'être pris. Choisis-en un autre.')
          else if (e instanceof Error) setRescheduleError(e.message)
          else setRescheduleError('Erreur lors du report, réessaie.')
        },
      }
    )
  }

  return (
    <div className="card p-4">
    <div className="flex items-start gap-4">
      {/* Date bloc */}
      <div className="flex-shrink-0 w-14 text-center bg-sage-50 rounded-xl py-2">
        <p className="text-xs text-sage-600 font-medium uppercase">{format(start, 'MMM', { locale: fr })}</p>
        <p className="text-2xl font-bold text-sage-700 leading-none">{format(start, 'd')}</p>
        <p className="text-xs text-gray-500 mt-0.5">{format(start, 'HH:mm')}</p>
        {/* Année affichée seulement si différente de l'année en cours —
            un RDV passé peut dater de plusieurs années, mois+jour seuls
            seraient ambigus (ex. "12 juil." 2025 vs 2026). */}
        {start.getFullYear() !== new Date().getFullYear() && (
          <p className="text-[9px] text-gray-400 leading-none mt-0.5">{format(start, 'yyyy')}</p>
        )}
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
            {showPatient && appointment.status === 'confirmed' && appointment.confirmed_by_patient_at && (
              <p className="text-xs text-green-600 font-medium mt-1">✓ Présence confirmée par le patient</p>
            )}
            {appointment.status === 'confirmed' && (
              <button onClick={handleAddToCalendar}
                className="inline-flex items-center gap-1 text-xs text-sage-600 hover:underline mt-1">
                📅 Ajouter à mon calendrier
              </button>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {attachments.map((doc: any) => (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sage-600 hover:underline">
                    📎 {doc.file_name}
                  </a>
                ))}
              </div>
            )}
            {showPatient && appointment.animals && appointment.animals.length > 0 && ['confirmed', 'completed'].includes(appointment.status) && (
              <div className="flex flex-wrap gap-2 mt-1">
                {appointment.animals.map(a => (
                  <Link key={a.id} to={`/animal/${a.id}`}
                    className="inline-flex items-center gap-1 text-xs text-sage-600 hover:underline">
                    🐾 Dossier de {a.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Avis : indépendant du RDV, se laisse depuis la fiche du praticien */}
            {!showPatient && (
              <Link to={`/doctor/${appointment.doctor_id}`}
                className="inline-block text-xs text-sage-600 hover:underline mt-1">
                ⭐ Laisser un avis sur ce praticien
              </Link>
            )}
          </div>
          <span className={STATUS_CLASSES[appointment.status]}>
            {STATUS_LABELS[appointment.status]}
          </span>
        </div>
      </div>

      {/* Actions */}
      {(canCancel || canReschedule) && (
        <div className="flex flex-col gap-1 items-end">
          {canReschedule && (
            <button
              onClick={() => { setShowReschedule(v => !v); setNewSlot(null); setRescheduleError('') }}
              className="text-xs text-sage-600 hover:text-sage-700 transition-colors font-medium">
              {showReschedule ? 'Annuler le report' : 'Reporter'}
            </button>
          )}
          {canCancel && (
            confirmingCancel ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { handleStatusChange('cancelled'); setConfirmingCancel(false) }}
                  disabled={update.isPending}
                  className="text-xs text-red-600 font-semibold hover:underline">
                  Confirmer ?
                </button>
                <button onClick={() => setConfirmingCancel(false)} className="text-xs text-gray-400 hover:underline">
                  Non
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingCancel(true)}
                className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors font-medium">
                Annuler
              </button>
            )
          )}
        </div>
      )}
      {user?.role === 'doctor' && appointment.status === 'pending' && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => handleStatusChange('confirmed')}
            disabled={update.isPending}
            className="text-xs btn-primary py-1 px-3">
            Confirmer
          </button>
          {confirmingRefuse ? (
            <div className="flex items-center gap-2 px-3">
              <button
                onClick={() => { handleStatusChange('cancelled'); setConfirmingRefuse(false) }}
                disabled={update.isPending}
                className="text-xs text-red-600 font-semibold hover:underline">
                Confirmer ?
              </button>
              <button onClick={() => setConfirmingRefuse(false)} className="text-xs text-gray-400 hover:underline">
                Non
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingRefuse(true)}
              className="text-xs btn-secondary py-1 px-3">
              Refuser
            </button>
          )}
        </div>
      )}
      {user?.role === 'doctor' && appointment.status === 'confirmed' && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => handleStatusChange('completed')}
            disabled={update.isPending}
            className="text-xs btn-primary py-1 px-3">
            ✓ Terminé
          </button>
          <button
            onClick={() => handleStatusChange('no_show')}
            disabled={update.isPending}
            className="text-xs btn-secondary py-1 px-3">
            Absent(e)
          </button>
          <button
            onClick={() => { setShowReschedule(v => !v); setNewSlot(null); setRescheduleError('') }}
            className="text-xs text-sage-600 hover:text-sage-700 transition-colors py-1 px-3">
            {showReschedule ? 'Annuler le report' : 'Reporter'}
          </button>
          {confirmingDoctorCancel ? (
            <div className="flex items-center gap-2 px-3">
              <button
                onClick={() => { handleStatusChange('cancelled'); setConfirmingDoctorCancel(false) }}
                disabled={update.isPending}
                className="text-xs text-red-600 font-semibold hover:underline">
                Confirmer ? (le patient sera prévenu)
              </button>
              <button onClick={() => setConfirmingDoctorCancel(false)} className="text-xs text-gray-400 hover:underline">
                Non
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDoctorCancel(true)}
              className="text-xs text-red-500 hover:text-red-700 transition-colors py-1 px-3">
              Annuler
            </button>
          )}
        </div>
      )}
      {actionError && <p className="text-red-500 text-xs mt-2">{actionError}</p>}
    </div>

    {/* Report de RDV : le praticien choisit directement un nouveau
        créneau (pas de proposition à valider par le patient — le patient
        est simplement notifié du changement, in-app/email/SMS via un
        trigger sur la mise à jour de start_at, voir migrations 076/077). */}
    {showReschedule && (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-3">Choisir un nouveau créneau</p>
        <AvailabilityCalendar doctorId={appointment.doctor_id} selected={newSlot} onSelect={setNewSlot} />
        {rescheduleError && <p className="text-red-500 text-xs mt-2">{rescheduleError}</p>}
        {newSlot && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleConfirmReschedule} disabled={reschedule.isPending}
              className="btn-primary text-sm">
              {reschedule.isPending ? 'Report en cours...' : `Confirmer le report au ${format(newSlot, "d MMM 'à' HH:mm", { locale: fr })}`}
            </button>
          </div>
        )}
      </div>
    )}
    </div>
  )
}
