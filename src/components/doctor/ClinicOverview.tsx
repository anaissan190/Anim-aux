// src/components/doctor/ClinicOverview.tsx
// Vue d'ensemble de l'onglet « Mon cabinet » : en-tête du cabinet, puis (pour son créateur)
// quatre indicateurs, l'activité de l'équipe en barres et ce qui demande une action. Un simple
// membre ne voit ni revenus ni activité des confrères, comme avant : seulement la place
// restante, le code d'invitation et le lien du calendrier. Pur affichage : les chiffres viennent
// de lib/clinicStats.ts.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MonthlyComparison } from '@/lib/doctorStats'
import { percentDelta } from '@/lib/doctorStats'
import type { ClinicStatsRow } from '@/lib/clinicStats'

interface HeaderProps {
  name: string
  city?: string | null
  address?: string | null
  logoUrl?: string | null
  // undefined = offre pas encore connue : aucune pastille plutôt qu'une erreur
  offerActive?: boolean
}

export function ClinicHeader({ name, city, address, logoUrl, offerActive }: HeaderProps) {
  const place = [address, city].filter(Boolean).join(', ')
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
        {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" alt="" loading="lazy" /> : '🏥'}
      </div>
      <div className="flex-1 min-w-[180px]">
        <h2 className="font-bold text-gray-900 text-lg leading-tight">{name}</h2>
        {place && <p className="text-sm text-gray-500 mt-0.5">{place}</p>}
      </div>
      {offerActive === true && <span className="text-xs px-2.5 py-1 rounded-full bg-moss-50 text-moss-800">✓ Abonnement cabinet</span>}
      {offerActive === false && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Cabinet non activé</span>}
    </div>
  )
}

// « +12 % » / « −8 % » / « +4 » (quand le mois précédent est à zéro) ; null s'il n'y a rien à dire.
export function deltaLabel(current: number, previous: number): { text: string; good: boolean } | null {
  if (current === previous) return null
  const pct = percentDelta(current, previous)
  const text = pct === null ? `+${current - previous}` : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`
  return { text: `${text} vs mois précédent`, good: current > previous }
}

function Tile({ label, value, delta, children }: {
  label: string; value: React.ReactNode; delta?: { text: string; good: boolean } | null; children?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
      {delta && <p className={`text-xs mt-1 ${delta.good ? 'text-moss-700' : 'text-red-500'}`}>{delta.text}</p>}
      {children}
    </div>
  )
}

interface Props {
  isAdmin: boolean
  memberCount: number
  maxMembers: number
  seatsLeft: number
  inviteCode: string
  calendarHref: string
  // Réservés au créateur
  monthly?: MonthlyComparison | null
  fillRate?: number | null
  activity?: ClinicStatsRow[]
  toReengage?: number
  unclosed?: number
  rating?: { average: number; count: number } | null
  onGoTo?: (section: 'equipe' | 'stats') => void
}

const MAX_BARS = 6

export default function ClinicOverview({
  isAdmin, memberCount, maxMembers, seatsLeft, inviteCode, calendarHref,
  monthly, fillRate, activity = [], toReengage = 0, unclosed = 0, rating, onGoTo,
}: Props) {
  const [copied, setCopied] = useState(false)
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
    } catch { /* presse-papiers indisponible : le code reste affiché, à recopier */ }
  }

  const sorted = [...activity].sort((a, b) => b.completedThisMonth - a.completedThisMonth)
  const shown = sorted.slice(0, MAX_BARS)
  const others = sorted.slice(MAX_BARS)
  const maxCount = Math.max(1, ...sorted.map(r => r.completedThisMonth))
  const showStats = isAdmin && monthly

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Praticiens" value={<>{memberCount} <span className="text-sm font-normal text-gray-400">/ {maxMembers}</span></>}>
          <div className="h-1.5 rounded-full bg-sand-100 mt-2 overflow-hidden">
            <div className="h-full bg-sage-500 rounded-full" style={{ width: `${Math.min(100, Math.round((memberCount / Math.max(1, maxMembers)) * 100))}%` }} />
          </div>
        </Tile>
        {showStats && (
          <>
            <Tile label="RDV terminés ce mois" value={monthly.current.completed} delta={deltaLabel(monthly.current.completed, monthly.previous.completed)} />
            <Tile label="Revenu estimé" value={`${monthly.current.revenue} €`} delta={deltaLabel(monthly.current.revenue, monthly.previous.revenue)} />
            <Tile label="Remplissage (30 jours)" value={fillRate === null || fillRate === undefined ? '—' : `${fillRate} %`}>
              {fillRate !== null && fillRate !== undefined && (
                <div className="h-1.5 rounded-full bg-sand-100 mt-2 overflow-hidden">
                  <div className="h-full bg-sage-500 rounded-full" style={{ width: `${fillRate}%` }} />
                </div>
              )}
            </Tile>
          </>
        )}
      </div>

      <div className={`grid gap-5 ${showStats ? 'lg:grid-cols-5' : ''}`}>
        {showStats && (
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Activité de l&apos;équipe ce mois-ci</h3>
            {sorted.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun praticien dans le cabinet.</p>
            ) : (
              <ul className="space-y-3">
                {shown.map(r => (
                  <li key={r.doctorId ?? r.name} className="flex items-center gap-3 text-sm">
                    <span className="w-28 truncate text-gray-700">{r.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-sand-100 overflow-hidden">
                      <div className="h-full bg-sage-500 rounded-full" style={{ width: `${Math.round((r.completedThisMonth / maxCount) * 100)}%` }} />
                    </div>
                    <span className="w-6 text-right font-medium text-gray-900 tabular-nums">{r.completedThisMonth}</span>
                  </li>
                ))}
                {others.length > 0 && (
                  <li className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="w-28">{others.length} autre{others.length > 1 ? 's' : ''}</span>
                    <div className="flex-1" />
                    <span className="w-6 text-right tabular-nums">{others.reduce((t, r) => t + r.completedThisMonth, 0)}</span>
                  </li>
                )}
              </ul>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Rendez-vous terminés.{' '}
              <button type="button" onClick={() => onGoTo?.('stats')} className="text-sage-600 hover:underline">Voir le détail</button>
            </p>
          </div>
        )}

        <div className={`space-y-5 ${showStats ? 'lg:col-span-2' : ''}`}>
          {showStats && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">À regarder</h3>
              <ul className="text-sm text-gray-700 divide-y divide-sand-100">
                <li className="py-2">
                  {toReengage > 0
                    ? <button type="button" onClick={() => onGoTo?.('stats')} className="text-left hover:text-sage-700">👥 {toReengage} patient{toReengage > 1 ? 's' : ''} à relancer</button>
                    : <span className="text-gray-400">👥 Aucun patient à relancer</span>}
                </li>
                <li className="py-2">
                  {unclosed > 0
                    ? <span>⏳ {unclosed} RDV passé{unclosed > 1 ? 's' : ''} à clôturer</span>
                    : <span className="text-gray-400">⏳ Tous les RDV passés sont clôturés</span>}
                </li>
                <li className="py-2">
                  {rating && rating.count > 0
                    ? <span>⭐ Note moyenne {rating.average.toString().replace('.', ',')} ({rating.count} avis)</span>
                    : <span className="text-gray-400">⭐ Pas encore d&apos;avis</span>}
                </li>
              </ul>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">Inviter un praticien</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center font-mono font-bold text-sage-600 bg-sage-50 px-3 py-2 rounded-lg text-sm tracking-widest">
                {inviteCode}
              </code>
              <button type="button" onClick={copyInvite} className="btn-secondary text-sm px-3 py-2">
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {seatsLeft > 0 ? `Il reste ${seatsLeft} place${seatsLeft > 1 ? 's' : ''}.` : 'Le cabinet est complet.'}
              {' '}<button type="button" onClick={() => onGoTo?.('equipe')} className="text-sage-600 hover:underline">Voir l&apos;équipe</button>
            </p>
          </div>

          <Link to={calendarHref}
            className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="text-xl">📅</span>
            <span className="flex-1">Ouvrir le calendrier du cabinet</span>
            <span className="text-gray-300">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
