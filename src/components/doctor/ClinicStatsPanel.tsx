// src/components/doctor/ClinicStatsPanel.tsx
// Statistiques d'un cabinet, vues par son créateur : le contenu COMPLET de l'onglet Statistiques
// d'un praticien seul (mois comparé, jours et heures chargés, motifs, avis, patients à relancer,
// export comptable…), pour tout le cabinet ou pour un praticien choisi, avec un comparatif entre
// praticiens au-dessus. Les calculs sont dans lib/clinicStats.ts ; DoctorStatsPanel fait la mise
// en forme du détail. Le revenu applique le tarif de chaque praticien.
import { useMemo, useState } from 'react'
import DoctorStatsPanel from '@/components/doctor/DoctorStatsPanel'
import {
  clinicPrices, clinicStatsTable, filterByDoctor, reviewSummary, memberName,
  type ClinicAppointmentForStats, type ClinicAvailabilityForStats, type ClinicMemberForStats,
  type ClinicReviewForStats, type ClinicStatsRow,
} from '@/lib/clinicStats'
import { priceByDoctor } from '@/lib/doctorStats'

interface Props {
  members: ClinicMemberForStats[]
  // Rendez-vous du cabinet tels que les renvoie useClinicAppointments (patientProfile = le patient).
  appointments: (ClinicAppointmentForStats & { patientProfile?: { first_name?: string; last_name?: string } | null })[]
  availabilities: ClinicAvailabilityForStats[]
  reviews: ClinicReviewForStats[]
  now?: Date
}

const pct = (v: number | null) => (v === null ? '—' : `${v} %`)
const eur = (v: number) => `${v} €`

function Row({ row, selected, onSelect, strong }: { row: ClinicStatsRow; selected: boolean; onSelect: () => void; strong?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 ${selected ? 'bg-sage-50' : ''} ${strong ? 'font-semibold' : ''}`}>
      <td className="py-2 pr-3 whitespace-nowrap">
        <button onClick={onSelect} className="text-left text-gray-900 hover:text-sage-600 hover:underline" aria-pressed={selected}>
          {row.name}
        </button>
      </td>
      <td className="py-2 px-2 text-right tabular-nums">{row.completedThisMonth}</td>
      <td className="py-2 px-2 text-right tabular-nums">{eur(row.revenueThisMonth)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{eur(row.revenueLast30Days)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{pct(row.noShowRate)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{pct(row.cancellationRate)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{pct(row.fillRate)}</td>
      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
        {row.rating === null ? '—' : `${row.rating.toString().replace('.', ',')} ★ (${row.reviewCount})`}
      </td>
    </tr>
  )
}

export default function ClinicStatsPanel({ members, appointments, availabilities, reviews, now = new Date() }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const table = useMemo(
    () => clinicStatsTable(members, appointments, availabilities, reviews, now),
    [members, appointments, availabilities, reviews, now],
  )
  const price = useMemo(() => priceByDoctor(clinicPrices(members)), [members])

  const scopeAppointments = useMemo(
    () => filterByDoctor(appointments, selected).map(a => ({ ...a, profiles: a.patientProfile ?? null })),
    [appointments, selected],
  )
  const scopeReviews = filterByDoctor(reviews, selected)
  const summary = reviewSummary(scopeReviews)
  const scopeLabel = selected ? (table.rows.find(r => r.doctorId === selected)?.name ?? 'Praticien') : 'tout le cabinet'

  return (
    <div className="space-y-6">
      {members.length > 1 && (
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-1">Comparatif des praticiens</h4>
          <p className="text-xs text-gray-400 mb-3">
            Revenu estimé = rendez-vous terminés × tarif de chaque praticien. Cliquez sur un nom pour voir ses statistiques détaillées.
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-x-auto">
            <table className="w-full text-sm text-gray-700">
              <thead>
                <tr className="text-xs text-gray-400 text-right">
                  <th className="text-left font-medium pb-2 pr-3">Praticien</th>
                  <th className="font-medium pb-2 px-2">RDV terminés (mois)</th>
                  <th className="font-medium pb-2 px-2">Revenu (mois)</th>
                  <th className="font-medium pb-2 px-2">Revenu (30 j)</th>
                  <th className="font-medium pb-2 px-2">Absences</th>
                  <th className="font-medium pb-2 px-2">Annulations</th>
                  <th className="font-medium pb-2 px-2">Remplissage</th>
                  <th className="font-medium pb-2 pl-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map(r => (
                  <Row key={r.doctorId} row={r} selected={selected === r.doctorId} onSelect={() => setSelected(r.doctorId)} />
                ))}
                <Row row={table.total} selected={selected === null} onSelect={() => setSelected(null)} strong />
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        {members.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Choisir le périmètre des statistiques">
            <button onClick={() => setSelected(null)} aria-pressed={selected === null}
              className={selected === null ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}>
              Tout le cabinet
            </button>
            {members.map(m => (
              <button key={m.doctor_id} onClick={() => setSelected(m.doctor_id)} aria-pressed={selected === m.doctor_id}
                className={selected === m.doctor_id ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}>
                {memberName(m)}
              </button>
            ))}
          </div>
        )}
        <h4 className="font-semibold text-sm text-gray-900 mb-3">Détail : {scopeLabel}</h4>
        <DoctorStatsPanel
          key={selected ?? 'all'}
          appointments={scopeAppointments as any}
          availabilities={filterByDoctor(availabilities, selected)}
          reviews={scopeReviews}
          consultationPrice={price}
          averageRating={summary.average}
          reviewCount={summary.count}
          now={now}
        />
      </div>
    </div>
  )
}
