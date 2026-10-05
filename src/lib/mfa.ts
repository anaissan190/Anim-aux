// src/lib/mfa.ts
// Double authentification (TOTP — application Google Authenticator, Authy...)
// via Supabase Auth MFA. Logique pure ici (testée) ; les appels réseau sont
// dans getMfaChallengeFactor() ci-dessous.
import { supabase } from './supabase'

export interface MfaFactor {
  id: string
  status: 'verified' | 'unverified' | string
  factor_type?: string
}

// Un facteur TOTP VÉRIFIÉ (enrôlement terminé) — un facteur "unverified" est
// un enrôlement abandonné à mi-chemin (QR code scanné mais code jamais saisi),
// qui ne doit jamais déclencher de demande de code à la connexion.
export function pickVerifiedTotpFactor(factors: MfaFactor[]): MfaFactor | null {
  return factors.find(f => f.status === 'verified' && (!f.factor_type || f.factor_type === 'totp')) ?? null
}

// Une session issue du seul mot de passe (aal1) doit être complétée par un
// code quand le compte a un facteur vérifié (nextLevel = aal2).
export function isMfaChallengeRequired(currentLevel: string | null | undefined, nextLevel: string | null | undefined): boolean {
  return currentLevel === 'aal1' && nextLevel === 'aal2'
}

// Le code TOTP est toujours 6 chiffres ; tolère les espaces collés depuis
// l'application ("123 456").
export function normalizeTotpCode(raw: string): string {
  return raw.replace(/\s+/g, '')
}

export function isValidTotpCode(raw: string): boolean {
  return /^\d{6}$/.test(normalizeTotpCode(raw))
}

// Facteur à défier pour la session courante, ou null si aucun code n'est
// demandé. En cas d'erreur réseau on renvoie null : ne jamais bloquer
// l'accès d'un utilisateur sans 2FA à cause d'une panne de lecture — mais un
// compte AVEC 2FA ne passe jamais ce garde-fou par erreur côté serveur de
// toute façon (voir la limite documentée dans le cahier des charges).
export async function getMfaChallengeFactor(): Promise<MfaFactor | null> {
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!aal || !isMfaChallengeRequired(aal.currentLevel, aal.nextLevel)) return null
    const { data: factors } = await supabase.auth.mfa.listFactors()
    return pickVerifiedTotpFactor((factors?.totp ?? []) as MfaFactor[])
  } catch {
    return null
  }
}

// Niveau d'assurance ("aal1" = mot de passe seul, "aal2" = code validé) lu
// dans le JWT de la session — sans aucun appel réseau, ce qui permet de
// l'utiliser DANS le callback onAuthStateChange (App.tsx), où appeler
// d'autres méthodes de supabase.auth risque un blocage (verrou déjà pris).
export function getAalFromAccessToken(accessToken: string | null | undefined): string | null {
  try {
    const payload = accessToken?.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).aal ?? null
  } catch {
    return null
  }
}

// Vrai si la session est au niveau mot de passe seul (aal1) alors que le
// compte a un facteur TOTP vérifié (session.user.factors est fourni par
// Supabase avec l'utilisateur) : un code reste à saisir.
export function sessionNeedsMfa(session: { access_token?: string; user?: { factors?: MfaFactor[] | null } } | null): boolean {
  if (!session) return false
  const hasVerified = pickVerifiedTotpFactor((session.user?.factors ?? []) as MfaFactor[]) !== null
  return hasVerified && getAalFromAccessToken(session.access_token) === 'aal1'
}
