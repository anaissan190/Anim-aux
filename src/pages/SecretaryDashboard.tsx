// src/pages/SecretaryDashboard.tsx
// Tableau de bord dédié au personnel administratif d'un cabinet (compte
// créé par le propriétaire, voir DoctorDashboard > Disponibilités >
// Partagées > Secrétariat). Ne montre que les informations du cabinet —
// jamais le profil personnel, la bio ou les tarifs d'un praticien précis.
import { useState } from 'react'
import Navbar from '@/components/ui/Navbar'
import { useAuthStore } from '@/lib/authStore'
import { useMyClinicStaffInfo, useClinicInfo, useClinicTeam, useClinicAgenda, useClinicPatients } from '@/hooks/useData'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Tab = 'agenda' | 'equipe' | 'patientele' | 'cabinet'

export default function SecretaryDashboard() {
  const { signOut } = useAuthStore()
  const { data: staffInfo, isLoading: staffLoading } = useMyClinicStaffInfo()
  const clinicId = staffInfo?.clinic_id

  const [tab, setTab] = useState<Tab>('agenda')

  const { data: clinicInfo } = useClinicInfo(clinicId)
  const { data: team = [] } = useClinicTeam(clinicId)
  const from = new Date()
  const to = addDays(from, 7)
  const { data: agenda = [], isLoading: agendaLoading } = useClinicAgenda(clinicId, from, to)
  const { data: patients = [], isLoading: patientsLoading } = useClinicPatients(clinicId)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'agenda', label: "Agenda de l'équipe" },
    { id: 'equipe', label: 'Équipe' },
    { id: 'patientele', label: 'Patientèle' },
    { id: 'cabinet', label: 'Infos du cabinet' },
  ]

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{staffInfo?.name ?? 'Cabinet'}</h1>
            <p className="text-sm text-gray-500">Espace secrétariat</p>
          </div>
        </div>

        {staffLoading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : !clinicId ? (
          <div className="card p-10 text-center">
            <div className="text-3xl mb-3">🏥</div>
            <p className="text-gray-700 font-medium">Aucun cabinet associé à ce compte.</p>
            <p className="text-sm text-gray-400 mt-1">Contactez le propriétaire du cabinet qui a créé cet accès.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit overflow-x-auto">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
                    ${tab === t.id ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'agenda' && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Rendez-vous des 7 prochains jours</h2>
                {agendaLoading ? (
                  <p className="text-sm text-gray-400">Chargement...</p>
                ) : agenda.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun rendez-vous sur cette période.</p>
                ) : (
                  <div className="space-y-2">
                    {agenda.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {format(new Date(a.start_at), "EEEE d MMM 'à' HH:mm", { locale: fr })}
                          </p>
                          <p className="text-xs text-gray-400">
                            Dr {a.doctor_first_name} {a.doctor_last_name}
                            {a.patient_first_name && ` · ${a.patient_first_name} ${a.patient_last_name}`}
                            {a.animal_name && ` · ${a.animal_name}`}
                          </p>
                        </div>
                        <span className="badge-green text-xs">{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'equipe' && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Praticiens du cabinet</h2>
                <div className="space-y-3">
                  {team.map((m: any) => (
                    <div key={m.doctor_id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-bold text-sm overflow-hidden">
                        {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" alt="" /> : (m.first_name?.[0]?.toUpperCase() ?? '?')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-gray-400">{m.specialty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'patientele' && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Patientèle du cabinet</h2>
                {patientsLoading ? (
                  <p className="text-sm text-gray-400">Chargement...</p>
                ) : patients.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun patient pour le moment.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {patients.map((p: any) => (
                      <div key={p.animal_id} className="border border-gray-100 rounded-xl p-3">
                        <p className="text-sm font-medium text-gray-800">{p.animal_name}</p>
                        <p className="text-xs text-gray-400">{p.species}</p>
                        <p className="text-xs text-gray-400 mt-1">{p.owner_first_name} {p.owner_last_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'cabinet' && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Informations du cabinet</h2>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-400">Nom :</span> {clinicInfo?.name}</p>
                  {clinicInfo?.address && <p><span className="text-gray-400">Adresse :</span> {clinicInfo.address}</p>}
                  {clinicInfo?.city && <p><span className="text-gray-400">Ville :</span> {clinicInfo.city}</p>}
                  {clinicInfo?.phone && <p><span className="text-gray-400">Téléphone :</span> {clinicInfo.phone}</p>}
                </div>
              </div>
            )}
          </>
        )}

        <button onClick={() => signOut()} className="text-sm text-gray-400 hover:text-red-500 mt-8">
          Déconnexion
        </button>
      </div>
    </div>
  )
}
