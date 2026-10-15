// src/components/admin/AdminQuotesView.tsx
// Administration → « Demandes de devis » : les questionnaires « Grand cabinet » (plus de 5
// praticiens, migration 135). Anaïs reçoit déjà chaque demande par email ; cette liste en
// garde la trace et le statut (nouvelle → devis envoyé → acceptée / refusée). Le devis est
// envoyé à la main. Quand il est accepté, la limite du cabinet se relève depuis sa fiche
// (Administration → Cabinets).
import { useRef, useState } from 'react'
import Navbar from '@/components/ui/Navbar'
import {
  useAdminQuoteRequests, useAdminUpdateQuoteRequest, useAdminPrepareQuotePayment, useAdminClearQuotePayment, type QuoteRequestRow,
} from '@/hooks/useData'
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_ORDER, isOpenQuote, type QuoteStatus } from '@/lib/cabinetQuote'
import { fr } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { PARIS_TZ } from '@/lib/parisTime'
import { formatCents, quotePaymentUrl, suggestedMonthlyCents, validateOffer } from '@/lib/quotePrice'

const STATUS_BADGE: Record<QuoteStatus, string> = {
  new: 'badge bg-amber-100 text-amber-700',
  quote_sent: 'badge bg-sage-100 text-sage-700',
  accepted: 'badge bg-green-100 text-green-700',
  declined: 'badge bg-gray-100 text-gray-600',
}

// Lien de paiement du devis : l'admin fixe le nombre de praticiens et le prix (pré-calculé selon la
// règle 95,90 € + 19,90 € par praticien en plus, modifiable pour une remise), copie le lien et le
// joint à son email. Quand le cabinet paie, la demande passe en « Devis accepté » toute seule.
function PaymentBlock({ q }: { q: QuoteRequestRow }) {
  const prepare = useAdminPrepareQuotePayment()
  const clear = useAdminClearQuotePayment()
  const [count, setCount] = useState(String(q.offer_max_practitioners ?? q.practitioner_count))
  const [price, setPrice] = useState(
    formatCents(q.offer_price_cents ?? suggestedMonthlyCents(q.offer_max_practitioners ?? q.practitioner_count)).replace(' €', ''),
  )
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)

  if (q.paid_at) {
    return (
      <div className="bg-green-50 border border-green-100 text-green-800 text-sm rounded-xl px-4 py-3 mb-3">
        ✓ Payé le {formatInTimeZone(new Date(q.paid_at), PARIS_TZ, 'd MMMM yyyy', { locale: fr })}
        {q.offer_price_cents ? ` — ${formatCents(q.offer_price_cents)} HT par mois` : ''}
        {q.offer_max_practitioners ? `, jusqu'à ${q.offer_max_practitioners} praticiens` : ''}. L&apos;abonnement du cabinet est actif.
      </div>
    )
  }

  const link = q.payment_token ? quotePaymentUrl(q.payment_token, window.location.origin) : null

  async function save() {
    setError('')
    setCopied(false)
    const offer = validateOffer(count, price)
    if (!offer.ok) { setError(offer.error); return }
    try {
      await prepare.mutateAsync({ quoteId: q.id, maxPractitioners: offer.maxPractitioners, priceCents: offer.priceCents })
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la création du lien.')
    }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      linkRef.current?.select()
    }
  }

  async function disable() {
    setError('')
    try {
      await clear.mutateAsync(q.id)
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la désactivation du lien.')
    }
  }

  return (
    <div className="border border-sand-200 rounded-xl p-4 mb-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Paiement du devis</p>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1" htmlFor={`cnt-${q.id}`}>Praticiens (maximum)</label>
          <input id={`cnt-${q.id}`} className="input text-sm w-28 py-1.5" inputMode="numeric" value={count} onChange={e => { setCount(e.target.value); setCopied(false) }} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1" htmlFor={`prc-${q.id}`}>Prix HT par mois (€)</label>
          <input id={`prc-${q.id}`} className="input text-sm w-32 py-1.5" inputMode="decimal" value={price} onChange={e => { setPrice(e.target.value); setCopied(false) }} />
        </div>
        <button onClick={save} disabled={prepare.isPending} className="btn-primary text-xs px-3 py-2">
          {link ? 'Mettre à jour le prix' : 'Créer le lien de paiement'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        Suggestion : 95,90 € + 19,90 € par praticien au-delà de 5. Modifie le prix pour une remise.
      </p>

      {link && (
        <>
          <label className="text-xs text-gray-400 block mb-1" htmlFor={`lnk-${q.id}`}>Lien à joindre à ton email</label>
          <div className="flex gap-2">
            <input id={`lnk-${q.id}`} ref={linkRef} readOnly className="input text-xs flex-1 py-1.5" value={link} onFocus={e => e.currentTarget.select()} />
            <button onClick={copy} className="btn-secondary text-xs px-3 py-1.5">{copied ? 'Copié ✓' : 'Copier le lien'}</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {q.offer_price_cents ? `Le lien réclame ${formatCents(q.offer_price_cents)} HT par mois, jusqu'à ${q.offer_max_practitioners} praticiens. ` : ''}
            {q.checkout_started_at
              ? `Le cabinet a ouvert la page de paiement le ${formatInTimeZone(new Date(q.checkout_started_at), PARIS_TZ, "d MMMM 'à' HH:mm", { locale: fr })}.`
              : "Le cabinet n'a pas encore ouvert la page de paiement."}
          </p>
          <button onClick={disable} disabled={clear.isPending} className="text-xs text-gray-400 hover:text-red-500 mt-2 underline">
            Désactiver le lien
          </button>
        </>
      )}
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  )
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

      <PaymentBlock q={q} />

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
