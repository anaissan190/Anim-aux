// src/components/admin/AdminQuotesView.tsx
// Administration → « Demandes de devis » : les questionnaires « Grand cabinet » (plus de 5
// praticiens, migration 135). Anaïs reçoit déjà chaque demande par email ; cette liste en
// garde la trace et le statut (nouvelle → devis envoyé → acceptée / refusée). Le devis est
// envoyé à la main. Quand il est accepté, la limite du cabinet se relève depuis sa fiche
// (Administration → Cabinets).
import { useState } from 'react'
import Navbar from '@/components/ui/Navbar'
import { useAdminQuoteRequests, useAdminUpdateQuoteRequest, type QuoteRequestRow } from '@/hooks/useData'
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_ORDER, isOpenQuote, type QuoteStatus } from '@/lib/cabinetQuote'
import { fr } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { PARIS_TZ } from '@/lib/parisTime'

const STATUS_BADGE: Record<QuoteStatus, string> = {
  new: 'badge bg-amber-100 text-amber-700',
  quote_sent: 'badge bg-sage-100 text-sage-700',
  accepted: 'badge bg-green-100 text-green-700',
  declined: 'badge bg-gray-100 text-gray-600',
}

function QuoteCard({ q, onStatusChanged }: { q: QuoteRequestRow; onStatusChanged: (q: QuoteRequestRow, to: QuoteStatus) => void }) {
  const update = useAdminUpdateQuoteRequest()
  const [note, setNote] = useState(q.admin_note ?? '')
  const [error, setError] = useState('')

  async function run(patch: { status?: QuoteStatus; adminNote?: string }) {
    setError('')
    try {
      await update.mutateAsync({ id: q.id, ...patch })
      if (patch.status) onStatusChanged(q, patch.status)
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la mise à jour.')
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-gray-900">{q.clinic_name}{q.city ? ` — ${q.city}` : ''}</h2>
          <p className="text-xs text-gray-400">
            Reçue le {formatInTimeZone(new Date(q.created_at), PARIS_TZ, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
        </div>
        <span className={STATUS_BADGE[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 mb-3">
        <div><span className="text-gray-400 text-xs block">Praticiens</span>{q.practitioner_count}</div>
        <div><span className="text-gray-400 text-xs block">Dans un an</span>{q.practitioner_count_next_year ?? '—'}</div>
        <div><span className="text-gray-400 text-xs block">Secrétariat</span>{q.secretary_count}</div>
        <div className="col-span-3">
          <span className="text-gray-400 text-xs block">Contact</span>
          {q.requester_name ? `${q.requester_name} · ` : ''}
          <a href={`mailto:${q.requester_email}`} className="text-sage-600 hover:underline">{q.requester_email}</a>
          {q.phone ? ` · ${q.phone}` : ''}
        </div>
      </div>

      {q.message && <p className="text-sm text-gray-700 bg-[#fff6e6] rounded-xl px-4 py-3 mb-3 whitespace-pre-wrap">{q.message}</p>}
      {!q.admin_notified_at && (
        <p className="text-xs text-amber-700 mb-3">
          L&apos;email de notification n&apos;a pas pu être envoyé pour cette demande : elle n&apos;est visible qu&apos;ici.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {QUOTE_STATUS_ORDER.map(s => (
          <button key={s} disabled={update.isPending || s === q.status} onClick={() => run({ status: s })}
            className={s === q.status ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}>
            {QUOTE_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <label className="text-xs text-gray-400 block mb-1" htmlFor={`note-${q.id}`}>Note (visible seulement par toi)</label>
      <textarea id={`note-${q.id}`} className="input text-sm min-h-[64px]" value={note} onChange={e => setNote(e.target.value)}
        onBlur={() => { if ((q.admin_note ?? '') !== note.trim()) run({ adminNote: note }) }}
        placeholder="Prix proposé, échanges, rappel à faire…" />
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  )
}

export default function AdminQuotesView({ onBack }: { onBack: () => void }) {
  const { data: quotes = [], isLoading, error } = useAdminQuoteRequests()
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const update = useAdminUpdateQuoteRequest()
  // Dit où est passée une demande quand elle quitte la liste « À traiter », et permet d'annuler.
  const [notice, setNotice] = useState<{ id: string; name: string; from: QuoteStatus; to: QuoteStatus } | null>(null)
  const [undoError, setUndoError] = useState('')
  const list = filter === 'open' ? quotes.filter(q => isOpenQuote(q.status)) : quotes
  const newCount = quotes.filter(q => q.status === 'new').length

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
          ← Retour
        </button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Demandes de devis</h1>
        <p className="text-sm text-gray-500 mb-4">
          Cabinets de plus de 5 praticiens. Réponds par email avec ton devis ; une fois accepté, relève la limite du cabinet depuis sa fiche (Cabinets).
        </p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setFilter('open')} className={filter === 'open' ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}>
            À traiter{newCount > 0 ? ` (${newCount} nouvelle${newCount > 1 ? 's' : ''})` : ''}
          </button>
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}>
            Toutes
          </button>
        </div>

        {notice && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-sage-50 border border-sage-100 text-sage-800 text-sm rounded-xl px-4 py-3 mb-4">
            <span>
              « {notice.name} » est passée en « {QUOTE_STATUS_LABEL[notice.to]} ».
              {filter === 'open' && !isOpenQuote(notice.to) ? ' Elle n\u2019apparaît plus dans « À traiter » : retrouve-la dans « Toutes ».' : ''}
            </span>
            <button className="btn-secondary text-xs px-3 py-1.5" disabled={update.isPending}
              onClick={async () => {
                setUndoError('')
                try {
                  await update.mutateAsync({ id: notice.id, status: notice.from })
                  setNotice(null)
                } catch (e: any) {
                  setUndoError(e.message ?? "Impossible d'annuler.")
                }
              }}>
              Annuler
            </button>
          </div>
        )}
        {undoError && <p className="text-red-500 text-xs mb-3">{undoError}</p>}

        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : error ? (
          <p className="text-sm text-red-500">Impossible de charger les demandes.</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-400">{filter === 'open' ? 'Aucune demande à traiter.' : 'Aucune demande pour le moment.'}</p>
        ) : (
          <div className="space-y-4">{list.map(q => (
            <QuoteCard key={q.id} q={q}
              onStatusChanged={(row, to) => setNotice({ id: row.id, name: row.clinic_name, from: row.status, to })} />
          ))}</div>
        )}
      </div>
    </div>
  )
}
