// src/components/auth/TwoFactorSettings.tsx
// Activation / désactivation de la double authentification (TOTP) — proposée
// aux praticiens et aux admins, sur leurs pages profil. Le code est demandé
// ensuite à chaque connexion (LoginPage). Voir src/lib/mfa.ts.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickVerifiedTotpFactor, isValidTotpCode, normalizeTotpCode, type MfaFactor } from '@/lib/mfa'
import { showToast } from '@/lib/toast'

export default function TwoFactorSettings() {
  const [factor, setFactor] = useState<MfaFactor | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDisable, setConfirmDisable] = useState(false)

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactor(pickVerifiedTotpFactor((data?.totp ?? []) as MfaFactor[]))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function startEnroll() {
    setError('')
    setBusy(true)
    // Un enrôlement abandonné (QR scanné, code jamais saisi) reste en base
    // "unverified" et ferait échouer le suivant (nom déjà pris) : on les nettoie.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of (existing?.all ?? []) as MfaFactor[]) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Animéaux' })
    setBusy(false)
    if (enrollError || !data) {
      setError(
        enrollError?.message?.toLowerCase().includes('not enabled')
          ? "La double authentification n'est pas activée sur le projet (Supabase > Authentication > Multi-Factor)."
          : (enrollError?.message ?? "Impossible de démarrer l'activation.")
      )
      return
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setCode('')
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enrolling) return
    if (!isValidTotpCode(code)) { setError('Saisissez le code à 6 chiffres affiché par votre application.'); return }
    setError('')
    setBusy(true)
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: normalizeTotpCode(code) })
    setBusy(false)
    if (verifyError) { setError('Code incorrect. Vérifiez l\'heure de votre téléphone et réessayez.'); return }
    setEnrolling(null)
    showToast('✓ Double authentification activée.')
    refresh()
  }

  async function cancelEnroll() {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id })
    setEnrolling(null)
    setError('')
  }

  async function disable() {
    if (!factor) return
    setBusy(true)
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    setBusy(false)
    if (unenrollError) { setError(unenrollError.message); return }
    setConfirmDisable(false)
    showToast('Double authentification désactivée.')
    refresh()
  }

  if (loading) return null

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <span className="text-xl">🔐</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">Double authentification</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Un code à 6 chiffres, généré par une application sur votre téléphone, est demandé en plus du mot de passe à chaque connexion.
          </p>

          {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

          {enrolling ? (
            <form onSubmit={confirmEnroll} className="mt-4 space-y-3">
              <p className="text-xs text-gray-600">
                1. Installez Google Authenticator, Authy ou Microsoft Authenticator.<br />
                2. Scannez ce QR code (ou saisissez la clé ci-dessous).<br />
                3. Saisissez le code à 6 chiffres affiché.
              </p>
              <img src={enrolling.qr} alt="QR code à scanner" className="w-40 h-40 border border-gray-100 rounded-xl" />
              <p className="text-[11px] text-gray-400 break-all">Clé de saisie manuelle : <span className="font-mono">{enrolling.secret}</span></p>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code}
                onChange={e => setCode(e.target.value)} className="input text-center tracking-[0.3em] w-40" placeholder="000000" />
              <div className="flex gap-3">
                <button type="submit" disabled={busy} className="btn-primary text-sm px-4 py-2">{busy ? 'Vérification...' : 'Activer'}</button>
                <button type="button" onClick={cancelEnroll} className="text-sm text-gray-400 hover:text-gray-600">Annuler</button>
              </div>
            </form>
          ) : factor ? (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="badge-green">Activée</span>
              {confirmDisable ? (
                <span className="flex items-center gap-3 text-xs">
                  <button onClick={disable} disabled={busy} className="text-red-500 font-semibold hover:underline">Oui, désactiver</button>
                  <button onClick={() => setConfirmDisable(false)} className="text-gray-400 hover:underline">Annuler</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDisable(true)} className="text-xs text-red-500 hover:underline">Désactiver</button>
              )}
            </div>
          ) : (
            <button onClick={startEnroll} disabled={busy} className="btn-secondary text-sm px-4 py-2 mt-3">
              {busy ? '...' : 'Activer la double authentification'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
