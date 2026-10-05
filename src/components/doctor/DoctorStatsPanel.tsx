// src/components/doctor/DoctorStatsPanel.tsx
// Contenu complet de l'onglet "Statistiques" du tableau de bord praticien —
// extrait de DoctorDashboard.tsx (octobre 2026, demande d'Anaïs d'enrichir
// cet onglet) pour garder le fichier principal lisible. Toute la logique de
// calcul est pure et testée dans src/lib/doctorStats.ts ; ce composant ne
// fait que mettre en forme ses résultats.
import { useState } from 'react'
import AnimatedBar from '@/components/ui/AnimatedBar'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'
import {
  computeDoctorStats, computeMonthlyComparison, monthlyBreakdown, busiestWeekdays, appointmentsByHour,
  newVsReturningPatients, topReasons, speciesBreakdown, averageBookingLeadTimeDays, lateCancellationRate,
  presenceConfirmationRate, computeReviewStats, patientsToReengage, patientReturnRate, percentDelta,
  type DoctorAvailabilityRule, type ExtendedStatsAppointment, type ReviewForStats,
} from '@/lib/doctorStats'

import { parisMonthKey, shiftMonthKey } from '@/lib/parisTime'
import { buildAccountingCsv, buildAccountingRows } from '@/lib/accountingExport'

// Mêmes libellés que l'onglet "RDV" (DoctorDashboard.tsx, DAYS), mais indexés
// comme parisDayOfWeek (0 = dimanche ... 6 = samedi) plutôt que lundi-premier.
const WEEKDAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

interface AppointmentWithPatient extends ExtendedStatsAppointment {
  profiles?: { first_name?: string; last_name?: string } | null
  animals?: { species: string; name?: string }[]
}

interface Props {
  appointments: AppointmentWithPatient[]
  availabilities: DoctorAvailabilityRule[]
  reviews: ReviewForStats[]
  consultationPrice: number
  averageRating: number
  reviewCount: number
  waitlistCount?: number
  now?: Date
}

export default function DoctorStatsPanel({
  appointments, availabilities, reviews, consultationPrice, averageRating, reviewCount, waitlistCount, now = new Date(),
}: Props) {
  const { totalRevenue, fillRate, hasUnclosedPastAppts } = computeDoctorStats(appointments, availabilities, consultationPrice, now)
  const monthly = computeMonthlyComparison(appointments, consultationPrice, now)
  const months = monthlyBreakdown(appointments, now, 6)
  const weekdays = busiestWeekdays(appointments, now, 90)
  const byHour = appointmentsByHour(appointments, now, 90)
  const patientsMix = newVsReturningPatients(appointments, now)
  const reasons = topReasons(appointments, 5)
  const species = speciesBreakdown(appointments)
  const leadTimeDays = averageBookingLeadTimeDays(appointments)
  const lateCancelRate = lateCancellationRate(appointments)
  const confirmationRate = presenceConfirmationRate(appointments, now)
  const reviewStats = computeReviewStats(reviews, now)
  const toReengage = patientsToReengage(appointments, now)
  const returnRate = patientReturnRate(appointments)

  const nameByPatient = new Map<string, string>()
  for (const a of appointments) {
    if (a.profiles?.first_name) nameByPatient.set(a.patient_id, `${a.profiles.first_name} ${a.profiles.last_name ?? ''}`.trim())
  }

  const [exportMonth, setExportMonth] = useState(parisMonthKey(now))
  const exportMonths = Array.from({ length: 12 }, (_, i) => shiftMonthKey(parisMonthKey(now), -i))
  const monthLabel = (key: string) =>
    new Date(`${key}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const exportCount = buildAccountingRows(appointments, exportMonth, consultationPrice).length

  function downloadExport() {
    const csv = buildAccountingCsv(appointments, exportMonth, consultationPrice)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `animeaux-consultations-${exportMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxMonthTotal = Math.max(1, ...months.map(m => m.completed + m.cancelled + m.noShow))
  const maxWeekdayCount = Math.max(1, ...weekdays.map(d => d.count))
  const maxReasonCount = Math.max(1, ...reasons.map(r => r.count))
  const busiestHour = byHour.length > 0 ? byHour.reduce((a, b) => (b.count > a.count ? b : a)) : null
  const quietestHour = byHour.length > 0 ? byHour.reduce((a, b) => (b.count < a.count ? b : a)) : null

  return (
    <div className="space-y-6">
      {hasUnclosedPastAppts && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
          💡 Vos statistiques resteront vides tant que vos rendez-vous passés ne sont pas clôturés.
          Marquez-les en <strong>Terminé</strong> ou <strong>Absent(e)</strong> (bouton sur chaque RDV,
          onglet Mon espace) pour voir apparaître revenu et taux de no-show.
        </div>
      )}

      {/* Ce mois-ci, comparé au mois calendaire précédent */}
      <div>
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Ce mois-ci</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="RDV terminés" value={monthly.current.completed} previous={monthly.previous.completed} />
          <KpiCard label="Revenu estimé" value={monthly.current.revenue} previous={monthly.previous.revenue} suffix=" €" />
          <KpiCard label="Taux d'absence" value={monthly.current.noShowRate} previous={monthly.previous.noShowRate} suffix="%" invertGood />
          <KpiCard label="Taux d'annulation" value={monthly.current.cancellationRate} previous={monthly.previous.cancellationRate} suffix="%" invertGood />
        </div>
      </div>

      {/* Depuis toujours / fenêtre glissante — indicateurs déjà existants, non liés au mois calendaire */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-xl font-bold text-sage-600"><AnimatedCounter target={totalRevenue} suffix=" €" /></p>
          <p className="text-xs text-gray-500 mt-1">Revenu total depuis toujours</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Remplissage (30 derniers jours)</p>
            <span className="text-sm font-bold text-sage-600">{fillRate !== null ? `${fillRate}%` : '—'}</span>
          </div>
          {fillRate !== null
            ? <AnimatedBar percent={fillRate} />
            : <p className="text-xs text-gray-400">Renseignez vos disponibilités pour voir cette statistique.</p>}
        </div>
      </div>

      {/* Histogramme des 6 derniers mois */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 mb-1">Rendez-vous par mois</h3>
        <p className="text-xs text-gray-400 mb-4">Les 6 derniers mois</p>
        <div className="flex items-end gap-3 h-32">
          {months.map(m => {
            const total = m.completed + m.cancelled + m.noShow
            return (
              <div key={m.monthKey} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[11px] text-gray-500">{total || ''}</span>
                <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: `${(total / maxMonthTotal) * 100}%`, minHeight: total > 0 ? 4 : 0 }}>
                  {m.noShow > 0 && <div className="w-full bg-red-400" style={{ height: `${(m.noShow / total) * 100}%` }} />}
                  {m.cancelled > 0 && <div className="w-full bg-amber-300" style={{ height: `${(m.cancelled / total) * 100}%` }} />}
                  {m.completed > 0 && <div className="w-full bg-sage-500" style={{ height: `${(m.completed / total) * 100}%` }} />}
                </div>
                <span className="text-[10.5px] text-gray-400 mt-1">
                  {new Date(`${m.monthKey}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'short' })}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 text-[11px] text-gray-500 mt-3">
          <Legend color="bg-sage-500" label="Terminés" />
          <Legend color="bg-amber-300" label="Annulés" />
          <Legend color="bg-red-400" label="Absences" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Jours les plus chargés */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900 mb-1">Jours les plus chargés</h3>
          <p className="text-xs text-gray-400 mb-3">Sur les 90 derniers jours</p>
          {weekdays.every(d => d.count === 0) ? (
            <p className="text-xs text-gray-400">Pas encore assez de rendez-vous pour voir une tendance.</p>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map(dayOfWeek => {
                const d = weekdays.find(w => w.dayOfWeek === dayOfWeek)!
                return (
                  <div key={dayOfWeek} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-gray-500 flex-shrink-0">{WEEKDAY_LABELS[dayOfWeek]}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sage-500 rounded-full" style={{ width: `${(d.count / maxWeekdayCount) * 100}%` }} />
                    </div>
                    <span className="w-5 text-right text-gray-600 font-medium flex-shrink-0">{d.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Patients nouveaux vs déjà venus */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900 mb-1">Vos patients</h3>
          <p className="text-xs text-gray-400 mb-3">Ce mois-ci</p>
          {patientsMix.new + patientsMix.returning === 0 ? (
            <p className="text-xs text-gray-400">Aucun rendez-vous terminé ce mois-ci pour l'instant.</p>
          ) : (
            <>
              <div className="flex h-3.5 rounded-full overflow-hidden mb-3">
                <div className="bg-sage-500" style={{ width: `${(patientsMix.new / (patientsMix.new + patientsMix.returning)) * 100}%` }} />
                <div className="bg-sage-200" style={{ width: `${(patientsMix.returning / (patientsMix.new + patientsMix.returning)) * 100}%` }} />
              </div>
              <div className="flex gap-4 text-xs">
                <Legend color="bg-sage-500" label={`Nouveaux : ${patientsMix.new}`} />
                <Legend color="bg-sage-200" label={`Déjà venus : ${patientsMix.returning}`} />
              </div>
            </>
          )}
          <p className="text-[11px] text-gray-400 mt-3">
            Un patient est « nouveau » s'il n'a jamais eu de rendez-vous terminé avec vous avant ce mois.
          </p>
        </div>
      </div>

      {/* Motifs les plus fréquents */}
      {reasons.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Motifs de consultation les plus fréquents</h3>
          <div className="space-y-2">
            {reasons.map(r => (
              <div key={r.reason} className="flex items-center gap-2 text-xs">
                <span className="w-40 text-gray-600 flex-shrink-0 truncate">{r.reason}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sage-400 rounded-full" style={{ width: `${(r.count / maxReasonCount) * 100}%` }} />
                </div>
                <span className="w-5 text-right text-gray-600 font-medium flex-shrink-0">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Avis */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Vos avis</h3>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-sage-600">{reviewCount > 0 ? averageRating.toFixed(1) : '—'}</span>
            <span className="text-xs text-gray-400">{reviewCount} avis au total</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {reviewStats.averageRatingCurrentMonth !== null
              ? <>Ce mois-ci : <strong>{reviewStats.averageRatingCurrentMonth.toFixed(1)}</strong>
                  {reviewStats.averageRatingPreviousMonth !== null && (
                    <RatingDelta current={reviewStats.averageRatingCurrentMonth} previous={reviewStats.averageRatingPreviousMonth} />
                  )}
                </>
              : 'Aucun avis ce mois-ci.'}
          </p>
          <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100">
            <span className="text-gray-500">Taux de réponse à vos avis</span>
            <span className="font-medium text-gray-900">{reviewStats.responseRate !== null ? `${reviewStats.responseRate}%` : '—'}</span>
          </div>
        </div>

        {/* Espèces vues */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Espèces vues</h3>
          {species.length === 0 ? (
            <p className="text-xs text-gray-400">Pas encore de rendez-vous à afficher.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {species.map(s => (
                <span key={s.species} className="inline-flex items-center gap-1.5 bg-sage-50 text-sage-700 text-xs font-medium px-3 py-1.5 rounded-full">
                  <span>{SPECIES_EMOJI[s.species] ?? '🐾'}</span>{s.species} · {s.count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Patients à recontacter */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm text-gray-900">Patients à recontacter</h3>
          {returnRate !== null && <span className="text-xs text-gray-500">Taux de retour : <strong className="text-gray-900">{returnRate}%</strong></span>}
        </div>
        <p className="text-xs text-gray-400 mb-3">Dernier rendez-vous terminé il y a plus de 6 mois</p>
        {toReengage.length === 0 ? (
          <p className="text-xs text-gray-400">Aucun patient à recontacter pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {toReengage.slice(0, 5).map(p => (
              <li key={p.patientId} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-800">{nameByPatient.get(p.patientId) ?? 'Patient'}</span>
                <span className="text-xs text-gray-400">il y a {p.monthsAgo} mois</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Trois petits indicateurs complémentaires */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SmallStat label="Délai de réservation moyen" value={leadTimeDays !== null ? `${leadTimeDays} j` : '—'} />
        <SmallStat label="Annulations tardives (< 24h)" value={lateCancelRate !== null ? `${lateCancelRate}%` : '—'} />
        <SmallStat label="Présence confirmée par le patient" value={confirmationRate !== null ? `${confirmationRate}%` : '—'} />
        <SmallStat label="En liste d'attente" value={waitlistCount !== undefined ? String(waitlistCount) : '—'} />
      </div>

      {/* Export comptable */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 mb-1">Export comptable</h3>
        <p className="text-xs text-gray-400 mb-3">
          Téléchargez la liste de vos consultations terminées d'un mois (lisible par Excel), avec le total.
          Le montant est votre tarif de consultation : une estimation, pas un justificatif comptable.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input text-sm w-auto" value={exportMonth} onChange={e => setExportMonth(e.target.value)}>
            {exportMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button onClick={downloadExport} disabled={exportCount === 0} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
            Télécharger ({exportCount} consultation{exportCount > 1 ? 's' : ''})
          </button>
        </div>
      </div>

      {byHour.length > 0 && busiestHour && quietestHour && (
        <p className="text-xs text-gray-400">
          Sur les 90 derniers jours, votre heure la plus demandée est <strong className="text-gray-600">{busiestHour.hour}h</strong>
          {quietestHour.hour !== busiestHour.hour && <> et votre heure la plus calme est <strong className="text-gray-600">{quietestHour.hour}h</strong></>}.
        </p>
      )}
    </div>
  )
}

function KpiCard({ label, value, previous, suffix = '', invertGood = false }: {
  label: string; value: number | null; previous: number | null; suffix?: string; invertGood?: boolean
}) {
  const delta = value !== null && previous !== null ? percentDelta(value, previous) : null
  const rawDelta = value !== null && previous !== null ? value - previous : null
  // invertGood : pour un taux qu'on préfère voir baisser (absence, annulation),
  // une baisse s'affiche en vert et une hausse en rouge — l'inverse d'un
  // compteur qu'on préfère voir monter (RDV, revenu).
  const isGood = rawDelta === null ? null : invertGood ? rawDelta <= 0 : rawDelta >= 0
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
      <p className={`text-2xl font-bold ${invertGood && value !== null && value > 15 ? 'text-red-500' : 'text-sage-600'}`}>
        {value !== null ? <AnimatedCounter target={value} suffix={suffix} /> : '—'}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {rawDelta !== null && rawDelta !== 0 && (
        <p className={`text-[11px] mt-1 font-medium ${isGood ? 'text-green-600' : 'text-red-500'}`}>
          {rawDelta > 0 ? '▲' : '▼'} {delta !== null ? `${Math.abs(delta)} %` : `${Math.abs(Math.round(rawDelta))}${suffix}`} vs le mois dernier
        </p>
      )}
    </div>
  )
}

function RatingDelta({ current, previous }: { current: number; previous: number }) {
  const diff = Math.round((current - previous) * 10) / 10
  if (diff === 0) return null
  return <span className={diff > 0 ? 'text-green-600' : 'text-red-500'}> ({diff > 0 ? '+' : ''}{diff} vs le mois dernier)</span>
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
      <p className="text-lg font-bold text-sage-600">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-sm ${color}`} />{label}
    </span>
  )
}
