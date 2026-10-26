// src/components/admin/PrelaunchPanel.tsx
// Écran admin « Pré-lancement » : bascule de la phase du site, date d'ouverture, seuil de
// praticiens, compteurs et export. Les réglages vivent dans app_settings (migration 137) : les
// dates affichées ici ne sont jamais codées en dur.
import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import {
  useLaunchSettings, useAdminSettings, useAdminSetSetting, useAdminPrelaunchStats, fetchAdminPrelaunchList,
} from '@/hooks/useData'
import { PARIS_TZ } from '@/lib/parisTime'
import {
  INTENDED_PLAN_LABEL, daysUntil, formatLaunchDate, isValidIsoDate, prelaunchToCsv, thresholdProgress,
} from '@/lib/prelaunch'

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3 text-sm my-2">
      <span className="w-40 truncate text-gray-700">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-sage-100 overflow-hidden">
        <div className="h-full rounded-full bg-moss-500" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
      </div>
      <span className="w-8 text-right font-semibold tabular-nums">{count}</span>
    </div>
  )
}

export default function PrelaunchPanel({ onBack }: { onBack: () => void }) {
  const { data: settings } = useLaunchSettings()
  const { data: adminSettings } = useAdminSettings()
  const { data: stats, isLoading, error } = useAdminPrelaunchStats()
  const setSetting = useAdminSetSetting()

  const [dateInput, setDateInput] = useState('')
  const [thresholdInput, setThresholdInput] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => { setDateInput(settings?.publicLaunchDate ?? '') }, [settings?.publicLaunchDate])
  useEffect(() => { setThresholdInput(adminSettings?.threshold ? String(adminSettings.threshold) : '') }, [adminSettings?.threshold])

  const isOpen = settings?.phase !== 'prelaunch'
  const threshold = adminSettings?.threshold ?? null
  const progress = stats ? thresholdProgress(stats.total, threshold) : null
  const remaining = daysUntil(settings?.publicLaunchDate ?? null)

  async function save(key: 'launch_phase' | 'public_launch_date' | 'prelaunch_threshold', value: string, ok: string) {
    setNotice('')
    try {
      await setSetting.mutateAsync({ key, value })
      setNotice(ok)
    } catch (e: any) {
      setNotice(e.message ?? "Erreur d'enregistrement.")
    }
  }

  function togglePhase() {
    const message = isOpen
      ? "Passer le site en pré-lancement ?\n\nL'accueil devient une page pour les praticiens, l'inscription propriétaire est fermée et aucun abonnement ne peut être payé."
      : "Ouvrir le site au public ?\n\nL'accueil et la recherche redeviennent ceux des propriétaires, et les abonnements redeviennent payables."
    if (!window.confirm(message)) return
    void save('launch_phase', isOpen ? 'prelaunch' : 'open', isOpen ? 'Le site est en pré-lancement.' : 'Le site est ouvert au public.')
  }

  async function exportCsv() {
    setExporting(true)
    setNotice('')
    try {
      const rows = await fetchAdminPrelaunchList()
      const blob = new Blob([prelaunchToCsv(rows)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `praticiens-prelancement-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setNotice(e.message ?? "Erreur lors de l'export.")
    } finally {
      setExporting(false)
    }
  }

  const weekly = (stats?.weekly ?? []).map(w => ({
    semaine: formatInTimeZone(new Date(w.week_start), PARIS_TZ, 'd MMM', { locale: fr }),
    Praticiens: w.count,
  }))
  const planMax = stats ? Math.max(stats.by_plan.free, stats.by_plan.pro, stats.by_plan.cabinet, stats.by_plan.none, 1) : 1
  const specMax = stats ? Math.max(...stats.by_specialty.map(s => s.count), 1) : 1
  const dateValid = dateInput === '' || isValidIsoDate(dateInput)

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour à l'administration
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Pré-lancement</h1>
        <p className="text-sm text-gray-500 mb-6">
          Compter les praticiens avant l'ouverture aux propriétaires d'animaux. Aucun paiement n'est possible tant que le site est en pré-lancement.
        </p>

        <div className="card p-5 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Ouverture au public</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isOpen
                ? 'Le site est ouvert : accueil, recherche et inscription propriétaire fonctionnent normalement.'
                : "Le site est en pré-lancement : l'accueil est réservé aux praticiens, qui s'inscrivent et choisissent leur formule sans payer."}
            </p>
          </div>
          <button type="button" role="switch" aria-checked={isOpen} onClick={togglePhase} disabled={setSetting.isPending || !settings}
            aria-label="Ouverture au public"
            className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${isOpen ? 'bg-moss-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${isOpen ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="card p-5">
            <label htmlFor="launch-date" className="block text-sm font-semibold text-gray-900 mb-1">Date d'ouverture affichée</label>
            <p className="text-xs text-gray-500 mb-3">Laissez vide tant qu'elle n'est pas décidée : le site affichera « Ouverture bientôt ».</p>
            <div className="flex gap-2">
              <input id="launch-date" type="date" className="input" value={dateInput} onChange={e => setDateInput(e.target.value)} />
              <button className="btn-secondary" disabled={!dateValid || setSetting.isPending || dateInput === (settings?.publicLaunchDate ?? '')}
                onClick={() => save('public_launch_date', dateInput, dateInput ? 'Date enregistrée.' : 'Date retirée.')}>
                Enregistrer
              </button>
            </div>
            {remaining != null && (
              <p className="text-xs text-gray-500 mt-2">
                {formatLaunchDate(settings?.publicLaunchDate ?? null)} : {remaining === 0 ? "c'est aujourd'hui" : `dans ${remaining} jour${remaining > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <div className="card p-5">
            <label htmlFor="launch-threshold" className="block text-sm font-semibold text-gray-900 mb-1">Seuil de praticiens</label>
            <p className="text-xs text-gray-500 mb-3">Nombre à atteindre pour ouvrir au public. Sert uniquement à la jauge ci-dessous, personne d'autre ne le voit.</p>
            <div className="flex gap-2">
              <input id="launch-threshold" type="number" min={1} className="input" placeholder="Pas encore défini"
                value={thresholdInput} onChange={e => setThresholdInput(e.target.value)} />
              <button className="btn-secondary" disabled={setSetting.isPending || thresholdInput === (threshold ? String(threshold) : '')}
                onClick={() => save('prelaunch_threshold', thresholdInput.trim(), thresholdInput.trim() ? 'Seuil enregistré.' : 'Seuil retiré.')}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        {notice && <p role="status" className="text-sm text-sage-700 bg-sage-50 border border-sage-100 rounded-xl px-4 py-2 mb-4">{notice}</p>}

        {error ? (
          <p className="text-sm text-red-600">Impossible de charger les compteurs : {(error as Error).message}</p>
        ) : isLoading || !stats ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : (
          <>
            <div className="grid lg:grid-cols-3 gap-4 mb-4">
              <div className="card p-5 lg:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Praticiens inscrits</p>
                <p className="font-serif text-5xl font-bold text-sage-600 mt-1 tabular-nums">
                  {stats.total}
                  {threshold != null && <span className="font-sans text-lg font-normal text-gray-400"> / {threshold}</span>}
                </p>
                {progress != null ? (
                  <>
                    <div className="h-3 rounded-full bg-sage-100 mt-4 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-sage-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{progress} % du seuil · +{stats.last_7_days} ces 7 derniers jours</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 mt-3">Pas de seuil défini · +{stats.last_7_days} ces 7 derniers jours</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4"><p className="text-xs text-gray-500">Dossiers validés</p><p className="text-2xl font-bold tabular-nums">{stats.verified}</p></div>
                <div className="card p-4"><p className="text-xs text-gray-500">À valider</p><p className="text-2xl font-bold tabular-nums text-amber-600">{stats.pending}</p></div>
                <div className="card p-4"><p className="text-xs text-gray-500">Rejetés</p><p className="text-2xl font-bold tabular-nums">{stats.rejected}</p></div>
                <div className="card p-4"><p className="text-xs text-gray-500">Formule non choisie</p><p className="text-2xl font-bold tabular-nums">{stats.by_plan.none}</p></div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Formule souhaitée</h2>
                <BarRow label={INTENDED_PLAN_LABEL.free} count={stats.by_plan.free} max={planMax} />
                <BarRow label={INTENDED_PLAN_LABEL.pro} count={stats.by_plan.pro} max={planMax} />
                <BarRow label={INTENDED_PLAN_LABEL.cabinet} count={stats.by_plan.cabinet} max={planMax} />
                <BarRow label="Pas encore choisie" count={stats.by_plan.none} max={planMax} />
              </div>
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Par métier</h2>
                {stats.by_specialty.length === 0
                  ? <p className="text-xs text-gray-400 py-4">Pas encore de données.</p>
                  : stats.by_specialty.map(s => <BarRow key={s.name} label={s.name} count={s.count} max={specMax} />)}
              </div>
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Inscriptions par semaine</h2>
                <p className="text-xs text-gray-400 mb-2">8 dernières semaines</p>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="semaine" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                    <Tooltip />
                    <Area type="monotone" dataKey="Praticiens" stroke="#f2820f" fill="#f2820f" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <button onClick={exportCsv} disabled={exporting} className="btn-secondary">
              {exporting ? 'Export…' : 'Exporter la liste (CSV)'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
