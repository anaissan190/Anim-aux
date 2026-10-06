// src/lib/chunkReload.ts
// Après une mise en ligne, les fichiers de l'ancienne version (noms à empreinte,
// ex. DoctorDashboard-DjXteUXO.js) disparaissent. Un utilisateur qui avait déjà
// ouvert l'application, ou une application installée dont le service worker vient
// de basculer, tombe alors sur « Failed to fetch dynamically imported module »
// dès qu'il ouvre une page chargée à la demande (relevé dans Sentry le 06/10/2026).
// Vite émet l'événement `vite:preloadError` dans ce cas : on recharge la page UNE
// fois pour récupérer la nouvelle version, avec un garde-fou contre une boucle de
// rechargements si le problème venait d'ailleurs (réseau, vrai fichier absent).
export const CHUNK_RELOAD_KEY = 'animeaux-chunk-reload-at'
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000

export function shouldReloadAfterChunkError(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > CHUNK_RELOAD_COOLDOWN_MS
}

interface InstallOptions {
  target?: Pick<Window, 'addEventListener'>
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  now?: () => number
  reload?: () => void
}

export function installChunkErrorReload({
  target = window,
  storage = safeSessionStorage(),
  now = Date.now,
  reload = () => window.location.reload(),
}: InstallOptions = {}): void {
  target.addEventListener('vite:preloadError', (event: Event) => {
    // Empêche l'erreur de remonter comme plantage : on la traite en rechargeant.
    event.preventDefault()
    let last: number | null = null
    try {
      const raw = storage?.getItem(CHUNK_RELOAD_KEY)
      last = raw ? Number(raw) : null
    } catch { /* stockage indisponible : on retombe sur le garde-fou "jamais rechargé" */ }
    if (!shouldReloadAfterChunkError(last, now())) return
    try { storage?.setItem(CHUNK_RELOAD_KEY, String(now())) } catch { /* idem */ }
    reload()
  })
}

function safeSessionStorage(): Storage | null {
  try { return window.sessionStorage } catch { return null }
}
