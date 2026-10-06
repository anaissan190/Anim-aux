// src/lib/authErrors.ts
// Classement des erreurs Supabase Auth en catégories que l'écran sait expliquer.
// Extrait de LoginPage pour être testé, et réutilisé par le renvoi de l'email
// de confirmation (même vocabulaire d'erreurs).
export type AuthErrorKind = 'email_not_confirmed' | 'captcha' | 'rate_limit' | 'other'

export function classifyAuthError(error: { code?: string; message?: string } | null | undefined): AuthErrorKind {
  const msg = error?.message?.toLowerCase() ?? ''
  if (error?.code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'email_not_confirmed'
  if (error?.code === 'captcha_failed' || msg.includes('captcha')) return 'captcha'
  if (error?.code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('security purposes')) return 'rate_limit'
  return 'other'
}
