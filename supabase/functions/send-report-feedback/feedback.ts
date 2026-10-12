// supabase/functions/send-report-feedback/feedback.ts
// Logique pure de l'email « retour sur votre signalement d'avis » (aucun import,
// donc testable avec Vitest : voir feedback.test.ts, et utilisable tel quel par
// la fonction Edge — Deno exige l'extension .ts à l'import).

// Note posée par défaut par l'écran admin quand l'avis est supprimé sans que
// l'admin ait écrit de commentaire (AdminDashboard.tsx). Elle sert d'historique
// côté admin ; on ne la présente pas au praticien comme un message de l'équipe.
export const DEFAULT_DELETE_NOTE = 'Avis supprimé'

export type FeedbackOutcome = 'deleted' | 'kept' | 'dismissed'

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Issue du signalement, déduite du statut et de l'existence de l'avis :
// un signalement « traité » dont l'avis n'existe plus = avis supprimé.
export function feedbackOutcome(status: 'resolved' | 'dismissed', reviewStillExists: boolean): FeedbackOutcome {
  if (status === 'dismissed') return 'dismissed'
  return reviewStillExists ? 'kept' : 'deleted'
}

// Commentaire de l'admin à montrer au praticien, ou null s'il n'y en a pas
// (vide, espaces, ou la note automatique de suppression).
export function adminComment(note: string | null | undefined): string | null {
  const trimmed = (note ?? '').trim()
  if (!trimmed || trimmed === DEFAULT_DELETE_NOTE) return null
  return trimmed
}

export function outcomeText(outcome: FeedbackOutcome): { title: string; body: string } {
  switch (outcome) {
    case 'deleted':
      return { title: "L'avis a été supprimé", body: "Nous avons retenu votre signalement : l'avis ne figure plus sur votre fiche." }
    case 'kept':
      return { title: "L'avis a été examiné et conservé", body: "Nous avons étudié votre signalement. L'avis reste visible sur votre fiche." }
    case 'dismissed':
      return { title: "Votre signalement n'a pas été retenu", body: "Après examen, l'avis respecte nos règles : il reste visible sur votre fiche." }
  }
}

export function stars(rating: number | null | undefined): string {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

export function excerpt(text: string | null | undefined, max = 300): string {
  const clean = (text ?? '').trim()
  return clean.length > max ? clean.slice(0, max).trimEnd() + '…' : clean
}

export interface FeedbackInput {
  firstName: string | null | undefined
  outcome: FeedbackOutcome
  note: string | null | undefined
  reason: string | null | undefined
  review: { rating?: number | null; comment?: string | null } | null
  reviewsUrl?: string
}

export function buildFeedbackEmail(input: FeedbackInput): { subject: string; html: string } {
  const { title, body } = outcomeText(input.outcome)
  const comment = adminComment(input.note)
  const hello = input.firstName?.trim() ? `Bonjour ${escapeHtml(input.firstName.trim())},` : 'Bonjour,'
  const url = input.reviewsUrl ?? 'https://monanimeaux.fr/dashboard/doctor?tab=avis'

  const reviewBlock = input.review
    ? `<p style="margin: 18px 0 4px; color: #6b7280; font-size: 13px;">Avis concerné</p>
       <p style="background: #f9fafb; border-radius: 10px; padding: 12px 16px; margin: 0;">
         <span style="color: #f59e0b;">${stars(input.review.rating)}</span>
         ${input.review.comment ? `<br />« ${escapeHtml(excerpt(input.review.comment))} »` : ''}
       </p>`
    : ''

  const reasonBlock = input.reason?.trim()
    ? `<p style="margin: 14px 0 4px; color: #6b7280; font-size: 13px;">Votre motif</p>
       <p style="margin: 0;">${escapeHtml(excerpt(input.reason, 400))}</p>`
    : ''

  const commentBlock = comment
    ? `<p style="margin: 18px 0 4px; color: #6b7280; font-size: 13px;">Le message de l'équipe Animéaux</p>
       <p style="background: #fff6e6; border-radius: 10px; padding: 12px 16px; margin: 0; white-space: pre-wrap;">${escapeHtml(comment)}</p>`
    : ''

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 16px;">
        <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
      </div>
      <h2 style="color: #d9670b;">Retour sur votre signalement</h2>
      <p>${hello}</p>
      <p>Vous nous avez signalé un avis sur votre fiche. Voici la suite donnée :</p>
      <p style="margin: 14px 0 4px; font-weight: bold;">${escapeHtml(title)}</p>
      <p style="margin: 0;">${escapeHtml(body)}</p>
      ${commentBlock}
      ${reviewBlock}
      ${reasonBlock}
      <p style="margin-top: 22px;">
        <a href="${escapeHtml(url)}" style="background: #d9670b; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 500;">
          Voir mes avis
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
    </div>
  `
  return { subject: "Votre signalement d'avis : retour d'Animéaux", html }
}
