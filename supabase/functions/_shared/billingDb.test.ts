// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ensureOwnedClinic, ensureStripeCustomer, hasPaidSubscription, inviteCode } from './billingDb'

interface Op { table: string; kind: 'select' | 'insert'; payload?: any; filters: Record<string, unknown> }
type Result = { data?: any; error?: any }

// Faux client Supabase : chaque requête (table + opération) est confiée à `handle`, qui renvoie
// le résultat voulu ; toutes les opérations vues sont gardées pour les vérifier ensuite.
function fakeDb(handle: (op: Op) => Result) {
  const seen: Op[] = []
  const db = {
    from(table: string) {
      const op: Op = { table, kind: 'select', filters: {} }
      const run = () => { seen.push({ ...op, filters: { ...op.filters } }); return Promise.resolve(handle(op)) }
      const b: any = {
        select() { return b },
        insert(payload: any) { op.kind = 'insert'; op.payload = payload; return b },
        eq(k: string, v: unknown) { op.filters[k] = v; return b },
        limit() { return b },
        maybeSingle: run,
        single: run,
        then(resolve: any, reject: any) { return run().then(resolve, reject) },
      }
      return b
    },
  }
  return { db, seen }
}

afterEach(() => vi.restoreAllMocks())

describe('inviteCode', () => {
  it('fait 8 caractères sans lettres ni chiffres ambigus', () => {
    for (let n = 0; n < 50; n++) expect(inviteCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
  })
  it('est déterministe quand on lui donne la source du hasard', () => {
    expect(inviteCode(() => 0)).toBe('AAAAAAAA')
  })
})

describe('ensureOwnedClinic', () => {
  const base = { userId: 'u1', doctorId: 'd1', log: 'test' }

  it("réutilise le cabinet existant du créateur, sans rien créer", async () => {
    const { db, seen } = fakeDb(() => ({ data: { id: 'c1', plan: 'free' } }))
    expect(await ensureOwnedClinic(db, { ...base, name: 'Peu importe' })).toEqual({ ok: true, clinicId: 'c1', plan: 'free', created: false })
    expect(seen.some(o => o.kind === 'insert')).toBe(false)
  })

  it("exige un nom quand il faut créer le cabinet", async () => {
    const { db, seen } = fakeDb(() => ({ data: null }))
    expect(await ensureOwnedClinic(db, { ...base, name: '   ' })).toEqual({ ok: false, code: 'clinic_name_required' })
    expect(seen.some(o => o.kind === 'insert')).toBe(false)
  })

  it("crée le cabinet non activé, avec son créateur comme premier praticien", async () => {
    const { db, seen } = fakeDb(op => {
      if (op.kind === 'select') return { data: null }
      if (op.table === 'clinics') return { data: { id: 'c9' } }
      return { error: null }
    })
    expect(await ensureOwnedClinic(db, { ...base, name: ' Cabinet Nord ', city: ' Lyon ' })).toEqual({ ok: true, clinicId: 'c9', plan: 'free', created: true })
    const clinic = seen.find(o => o.kind === 'insert' && o.table === 'clinics')!
    expect(clinic.payload).toMatchObject({ name: 'Cabinet Nord', city: 'Lyon', owner_id: 'u1' })
    expect(clinic.payload.invite_code).toMatch(/^[A-Z2-9]{8}$/)
    expect(clinic.payload).not.toHaveProperty('plan') // jamais activé ici
    expect(seen.find(o => o.kind === 'insert' && o.table === 'clinic_members')!.payload).toEqual({ clinic_id: 'c9', doctor_id: 'd1' })
  })

  it('remonte une erreur interne si la création du cabinet ou de son membre échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const noMember = fakeDb(op => op.kind === 'select' ? { data: null } : op.table === 'clinics' ? { data: { id: 'c9' } } : { error: { message: 'x' } })
    expect(await ensureOwnedClinic(noMember.db, { ...base, name: 'N' })).toEqual({ ok: false, code: 'internal' })
    const noClinic = fakeDb(op => op.kind === 'select' ? { data: null } : { data: null, error: { message: 'x' } })
    expect(await ensureOwnedClinic(noClinic.db, { ...base, name: 'N' })).toEqual({ ok: false, code: 'internal' })
  })
})

describe('hasPaidSubscription', () => {
  const withRows = (rows: any[]) => fakeDb(() => ({ data: rows })).db

  it("vrai pour un abonnement actif, en essai ou en relance de paiement qui n'est pas résilié", async () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(await hasPaidSubscription(withRows([{ status, cancel_at_period_end: false }]), 'clinic', 'c1')).toBe(true)
    }
  })
  it("faux pour une résiliation programmée, un abonnement terminé ou aucun abonnement", async () => {
    expect(await hasPaidSubscription(withRows([{ status: 'active', cancel_at_period_end: true }]), 'clinic', 'c1')).toBe(false)
    expect(await hasPaidSubscription(withRows([{ status: 'canceled', cancel_at_period_end: false }]), 'clinic', 'c1')).toBe(false)
    expect(await hasPaidSubscription(withRows([]), 'clinic', 'c1')).toBe(false)
    expect(await hasPaidSubscription(withRows(null as any), 'doctor', 'd1')).toBe(false)
  })
  it("interroge la bonne colonne selon la cible (cabinet ou praticien)", async () => {
    const clinic = fakeDb(() => ({ data: [] })); await hasPaidSubscription(clinic.db, 'clinic', 'c1')
    expect(clinic.seen[0].filters).toEqual({ clinic_id: 'c1' })
    const doctor = fakeDb(() => ({ data: [] })); await hasPaidSubscription(doctor.db, 'doctor', 'd1')
    expect(doctor.seen[0].filters).toEqual({ doctor_id: 'd1' })
  })
})

describe('ensureStripeCustomer', () => {
  it("réutilise le client Stripe déjà connu, sans appeler Stripe", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { db } = fakeDb(() => ({ data: { stripe_customer_id: 'cus_known' } }))
    expect(await ensureStripeCustomer(db, 'sk_test_x', { userId: 'u1', email: 'a@b.fr', log: 'test' })).toEqual({ ok: true, customerId: 'cus_known' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("crée un client Stripe pour un nouveau compte et l'enregistre", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'cus_new' }), { status: 200 }))
    const { db, seen } = fakeDb(op => op.kind === 'select' ? { data: null } : { error: null })
    expect(await ensureStripeCustomer(db, 'sk_test_x', { userId: 'u1', email: 'a@b.fr', log: 'test' })).toEqual({ ok: true, customerId: 'cus_new' })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.stripe.com/v1/customers')
    expect(String(init.body)).toContain('metadata%5Buser_id%5D=u1')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_x')
    expect(seen.find(o => o.kind === 'insert')!.payload).toEqual({ user_id: 'u1', stripe_customer_id: 'cus_new' })
  })

  it("signale l'échec quand Stripe refuse", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'nope' } }), { status: 401 }))
    const { db } = fakeDb(() => ({ data: null }))
    expect(await ensureStripeCustomer(db, 'sk_test_x', { userId: 'u1', log: 'test' })).toEqual({ ok: false })
  })
})
