// src/pages/RemindersPage.tsx
// Tuile "Rappels" du dashboard patient : rendez-vous déjà planifiés à venir
// + rappels de vaccin, tous animaux confondus (voir usePatientReminders).
import { format, differenceInCalendarDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import { usePatientReminders } from '@/hooks/useData'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'

export default function RemindersPage() {
  const { data, isLoading, error } = usePatientReminders()
  const appointments = data?.appointments ?? []
  const vaccineReminders = data?.vaccineReminders ?? []

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <BackButton fallback="/dashboard/patient" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">🔔 Rappels</h1>
          <p className="text-gray-500 text-sm mt-1">Vos prochains rendez-vous et rappels de vaccin, au même endroit.</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="card p-5 mb-4 border-2 border-red-200">
            <p className="text-sm text-red-500">Impossible de charger vos rappels pour le moment. Réessayez dans un instant.</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <h2 className="font-semibold text-gray-900 mb-3">📅 Prochains rendez-vous</h2>
            {appointments.length === 0 ? (
              <div className="card p-6 text-center mb-8">
                <p className="text-gray-400 text-sm">Aucun rendez-vous planifié.</p>
                <Link to="/search" className="btn-primary inline-block mt-3 text-sm">Prendre un rendez-vous</Link>
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {appointments.map((a: any) => {
                  const doctorProfile = a.doctors?.profiles
                  const days = differenceInCalendarDays(new Date(a.start_at), new Date())
                  return (
                    <div key={a.id} className="card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-lg flex-shrink-0">📅</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">
                          Dr {doctorProfile?.first_name} {doctorProfile?.last_name}
                          {a.doctors?.specialty && <span className="text-gray-400 font-normal"> · {a.doctors.specialty}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(a.start_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                          {a.reason && ` · ${a.reason}`}
                        </p>
                      </div>
                      <span className="text-xs bg-moss-100 text-moss-700 px-2 py-1 rounded-full flex-shrink-0">
                        {days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} j`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <h2 className="font-semibold text-gray-900 mb-3">💉 Rappels vaccins</h2>
            {vaccineReminders.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-gray-400 text-sm">Aucun rappel de vaccin en cours.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vaccineReminders.map((v: any) => {
                  const days = differenceInCalendarDays(new Date(v.next_due_date), new Date())
                  const overdue = days < 0
                  const soon = days >= 0 && days <= 30
                  return (
                    <Link key={v.id} to={v.animal ? `/animal/${v.animal.id}` : '#'}
                      className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-lg flex-shrink-0">💉</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">
                          {v.name}
                          {v.animal && <span className="text-gray-400 font-normal"> · {SPECIES_EMOJI[v.animal.species] ?? '🐾'} {v.animal.name}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          Rappel prévu le {format(new Date(v.next_due_date), 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                        overdue ? 'bg-red-100 text-red-600' : soon ? 'bg-sage-100 text-sage-700' : 'bg-moss-100 text-moss-700'
                      }`}>
                        {overdue ? 'En retard' : days === 0 ? "Aujourd'hui" : `Dans ${days} j`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
