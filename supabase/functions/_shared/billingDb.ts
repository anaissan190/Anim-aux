// supabase/functions/_shared/billingDb.ts
// Étapes communes aux fonctions qui ouvrent une page de paiement Stripe
// (create-checkout-session : prix fixes ; create-quote-checkout : prix d'un devis) :
// cabinet du créateur, client Stripe du compte, abonnement déjà en cours, appel à Stripe.
// Aucun import (le client Supabase est passé en paramètre) : testable avec Vitest.
import { isPaidStatus } from './billing.ts'

// Le client Supabase n'est typé que par ce dont on se sert ici ; un vrai client convient.
// deno-lint-ignore no-explicit-any
export type Db = any

export async function stripePost(key: string, path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

// Phase de pré-lancement (migration 137) : tant qu'elle dure, aucun paiement ne s'ouvre, quel que
// soit l'écran appelant. Une lecture impossible lève l'erreur : l'appelant répond « internal » et
// rien n'est payé, plutôt que d'ouvrir un paiement par défaut.
export async function isPrelaunch(db: Db): Promise<boolean> {
  const { data, error } = await db.from('app_settings').select('value').eq('key', 'launch_phase').maybeSingle()
  if (error) throw new Error(`lecture de launch_phase impossible : ${error.message ?? error}`)
  return data?.value === 'prelaunch'
}

// Même alphabet que le code d'invitation créé côté application (useCreateClinic).
export function inviteCode(random: () => number = Math.random): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += chars[Math.floor(random() * chars.length)]
  return out
}

export type OwnedClinic =
  | { ok: true; clinicId: string; plan: string | null; created: boolean }
  | { ok: false; code: 'clinic_name_required' | 'internal' }

// Le cabinet dont la personne est créatrice ; à défaut, il est créé (nom obligatoire) avec
// elle comme premier praticien, NON activé : seule la confirmation du paiement l'active.
export async function ensureOwnedClinic(
  db: Db,
  i: { userId: string; doctorId: string; name: string; city?: string | null; log: string },
): Promise<OwnedClinic> {
  const { data: clinic } = await db
    .from('clinics').select('id, plan').eq('owner_id', i.userId).limit(1).maybeSingle()
  if (clinic) return { ok: true, clinicId: clinic.id, plan: clinic.plan ?? null, created: false }

  const name = i.name.trim()
  if (!name) return { ok: false, code: 'clinic_name_required' }
  const { data: created, error: createErr } = await db
    .from('clinics')
    .insert({ name, city: i.city?.trim() || null, owner_id: i.userId, invite_code: inviteCode() })
    .select('id').single()
  if (createErr || !created) {
    console.error(`${i.log}: création du cabinet`, createErr)
    return { ok: false, code: 'internal' }
  }
  const { error: memberErr } = await db
    .from('clinic_members').insert({ clinic_id: created.id, doctor_id: i.doctorId })
  if (memberErr) {
    console.error(`${i.log}: ajout du créateur au cabinet`, memberErr)
    return { ok: false, code: 'internal' }
  }
  return { ok: true, clinicId: created.id, plan: 'free', created: true }
}

// Un abonnement actif et non résilié existe déjà pour cette cible : on n'en crée pas un second.
export async function hasPaidSubscription(db: Db, kind: 'doctor' | 'clinic', targetId: string): Promise<boolean> {
  const { data } = await db
    .from('subscriptions').select('status, cancel_at_period_end')
    .eq(kind === 'doctor' ? 'doctor_id' : 'clinic_id', targetId)
  return ((data ?? []) as Array<{ status: string; cancel_at_period_end: boolean }>)
    .some(s => isPaidStatus(s.status) && !s.cancel_at_period_end)
}

// Client Stripe : un par compte, réutilisé aux paiements suivants (et par le portail).
export async function ensureStripeCustomer(
  db: Db,
  key: string,
  i: { userId: string; email?: string | null; log: string },
): Promise<{ ok: true; customerId: string } | { ok: false }> {
  const { data: known } = await db
    .from('billing_customers').select('stripe_customer_id').eq('user_id', i.userId).maybeSingle()
  if (known) return { ok: true, customerId: known.stripe_customer_id }

  const created = await stripePost(key, 'customers', new URLSearchParams({
    ...(i.email ? { email: i.email } : {}),
    'metadata[user_id]': i.userId,
  }))
  if (!created.ok || !created.body.id) {
    console.error(`${i.log}: création du client Stripe`, created.status, JSON.stringify(created.body).slice(0, 500))
    return { ok: false }
  }
  const { error: saveErr } = await db
    .from('billing_customers').insert({ user_id: i.userId, stripe_customer_id: created.body.id })
  if (saveErr) console.error(`${i.log}: enregistrement du client`, saveErr)
  return { ok: true, customerId: created.body.id }
}
