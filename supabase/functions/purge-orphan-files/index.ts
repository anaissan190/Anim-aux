// supabase/functions/purge-orphan-files/index.ts
// Nettoyage hebdomadaire des fichiers de stockage orphelins (avatars, documents,
// justificatifs de praticiens) : fichiers que plus aucune ligne de la base ne
// référence — compte ou animal supprimé, ancienne photo remplacée, document retiré.
// Constaté le 06/10/2026 : 24 fichiers orphelins accumulés pendant les tests, dont
// des justificatifs d'identité de praticiens supprimés (droit à l'effacement).
// Un `delete` SQL sur storage.objects laisserait les fichiers réels : on passe par
// l'API Storage, avec la clé service_role de la fonction.
//
// Garde-fous (une erreur ici supprimerait de vrais documents) :
//  * jamais un fichier de moins de 24 h — un fichier téléversé pendant une
//    réservation existe avant que sa ligne `appointment_documents` soit créée ;
//  * arrêt sans rien supprimer si plus de la moitié des fichiers d'un dossier
//    semblent orphelins (signe d'un critère faux, pas d'un vrai ménage) ;
//  * au plus 200 suppressions par exécution ;
//  * `?dry_run=1` : liste ce qui serait supprimé sans rien effacer.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const MIN_AGE_MS = 24 * 60 * 60 * 1000
const MAX_DELETIONS = 200

// Même contrôle que les autres fonctions appelées par un trigger/cron : secret
// dédié PUSH_TRIGGER_SECRET (lu dans Vault par le job pg_cron), CRON_SECRET, ou
// clé service_role.
function isAuthorized(req: Request): boolean {
  const received = (req.headers.get('Authorization') ?? '').trim()
  const accepted = [Deno.env.get('PUSH_TRIGGER_SECRET'), Deno.env.get('CRON_SECRET'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .map(s => `Bearer ${s.trim()}`)
  return accepted.includes(received)
}

type StoredFile = { name: string; createdAt: number }

async function listAll(bucket: string, prefix = ''): Promise<StoredFile[]> {
  const out: StoredFile[] = []
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset: 0 })
  if (error) throw error
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) out.push(...await listAll(bucket, full))
    else out.push({ name: full, createdAt: new Date(item.created_at ?? 0).getTime() })
  }
  return out
}

async function referencedUrls(table: string, column: string): Promise<string[]> {
  const { data, error } = await supabase.from(table).select(column).not(column, 'is', null).limit(10000)
  if (error) throw error
  return (data ?? []).map((r: any) => r[column]).filter(Boolean)
}

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 })
  const dryRun = new URL(req.url).searchParams.get('dry_run') === '1'

  try {
    const refs: Record<string, string[]> = {
      avatars: [
        ...await referencedUrls('profiles', 'avatar_url'),
        ...await referencedUrls('animals', 'avatar_url'),
        ...await referencedUrls('clinics', 'logo_url'),
      ],
      documents: [
        ...await referencedUrls('animal_documents', 'file_url'),
        ...await referencedUrls('appointment_documents', 'file_url'),
      ],
      'verification-documents': await referencedUrls('doctor_verification_documents', 'file_url'),
    }

    const now = Date.now()
    const report: Record<string, { total: number; orphans: string[]; skipped?: string }> = {}
    let remaining = MAX_DELETIONS

    for (const bucket of Object.keys(refs)) {
      const files = await listAll(bucket)
      const orphans = files.filter(f =>
        now - f.createdAt > MIN_AGE_MS && !refs[bucket].some(u => u === f.name || u.endsWith('/' + f.name))
      )
      report[bucket] = { total: files.length, orphans: orphans.map(f => f.name) }

      if (files.length > 0 && orphans.length > files.length / 2 && files.length >= 6) {
        report[bucket].skipped = 'plus de la moitié des fichiers semblent orphelins — vérification manuelle requise'
        continue
      }
      const toDelete = orphans.slice(0, Math.max(remaining, 0)).map(f => f.name)
      if (!dryRun && toDelete.length > 0) {
        const { error } = await supabase.storage.from(bucket).remove(toDelete)
        if (error) throw error
        remaining -= toDelete.length
      }
    }

    console.log('purge-orphan-files', dryRun ? '(simulation)' : '', JSON.stringify(
      Object.fromEntries(Object.entries(report).map(([b, r]) => [b, { total: r.total, orphans: r.orphans.length, skipped: r.skipped }]))
    ))
    return new Response(JSON.stringify({ dryRun, report }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('purge-orphan-files error', e)
    return new Response('Erreur', { status: 500 })
  }
})
