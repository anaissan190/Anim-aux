// src/pages/RegisterPage.tsx
import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { PRACTITIONER_TYPES } from '@/lib/practitionerTypes'
import { ETHICS_CHARTER_CLAUSES, ETHICS_CHARTER_DISCLAIMER } from '@/lib/ethicsCharter'
import logoNavbar from '@/assets/logo-navbar.webp'
import PasswordInput from '@/components/ui/PasswordInput'
import Turnstile from '@/components/ui/Turnstile'
import PractitionerTypePicker from '@/components/doctor/PractitionerTypePicker'

const schema = z.object({
  first_name:        z.string().min(2, 'Prénom requis'),
  last_name:         z.string().min(2, 'Nom requis'),
  email:             z.string().email('Email invalide'),
  password:          z.string().min(8, 'Minimum 8 caractères'),
  role:              z.enum(['patient', 'doctor']),
  practitioner_types: z.array(z.string()).optional(),
})

// CGU et Politique de confidentialité restent des pages à part entière
// (target="_blank" — ouvre un vrai nouvel onglet sur desktop, où le
// formulaire n'est jamais démonté). Sur mobile/PWA, target="_blank" ne
// garantit aucun nouvel onglet : ça navigue dans le même contexte, et
// l'état local du formulaire est perdu au démontage. Plutôt que de
// dupliquer ces longs documents (CGU/confidentialité) dans une fenêtre
// comme pour la charte bien-être animal (courte, 6 puces), on sauvegarde
// une copie de brouillon du formulaire à chaque frappe : n'importe quel
// lien qui ferait naviguer hors de cette page — CGU, confidentialité, ou
// un futur lien qu'on oublierait de traiter au cas par cas — restaure
// automatiquement la saisie en cours au retour. Le mot de passe n'est
// volontairement jamais persisté (hygiène de base).
//
// localStorage plutôt que sessionStorage (choix corrigé le 21/09/2026,
// après un premier essai en sessionStorage qui ne réglait pas le problème
// pour Anaïs) : sur iOS/PWA, target="_blank" ouvre parfois un VRAI second
// onglet/contexte — et sessionStorage n'est jamais partagé entre onglets,
// même de même origine, contrairement à localStorage. Le brouillon
// survivait donc dans l'onglet d'origine (jamais démonté) mais restait
// invisible depuis le second onglet où elle cliquait "Retour".
const REGISTER_DRAFT_KEY = 'animeaux_register_draft'

function loadRegisterDraft(): Partial<{
  first_name: string; last_name: string; email: string
  role: 'patient' | 'doctor'; practitioner_types: string[]; otherProfession: string
  acceptedTerms: boolean; acceptedEthicsCharter: boolean
}> {
  try {
    const raw = localStorage.getItem(REGISTER_DRAFT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export default function RegisterPage() {
  const navigate   = useNavigate()
  const [params]   = useSearchParams()
  const draft = loadRegisterDraft()
  const defaultRole = draft.role ?? (params.get('role') === 'doctor' ? 'doctor' : 'patient')

  const [form, setForm] = useState({
    first_name: draft.first_name ?? '', last_name: draft.last_name ?? '',
    email: draft.email ?? '', password: '',
    role: defaultRole as 'patient' | 'doctor',
    practitioner_types: draft.practitioner_types ?? [] as string[],
  })
  const [otherProfession, setOtherProfession] = useState(draft.otherProfession ?? '')
  const [acceptedTerms, setAcceptedTerms] = useState(draft.acceptedTerms ?? false)
  const [acceptedEthicsCharter, setAcceptedEthicsCharter] = useState(draft.acceptedEthicsCharter ?? false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [showCharterModal, setShowCharterModal] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify({
        first_name: form.first_name, last_name: form.last_name, email: form.email,
        role: form.role, practitioner_types: form.practitioner_types, otherProfession,
        acceptedTerms, acceptedEthicsCharter,
      }))
    } catch {
      // localStorage indisponible (navigation privée stricte...) : le
      // brouillon ne survivra pas à une navigation, mais le formulaire
      // reste utilisable normalement — best-effort, pas bloquant.
    }
  }, [form.first_name, form.last_name, form.email, form.role, form.practitioner_types, otherProfession, acceptedTerms, acceptedEthicsCharter])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError('')

    if (form.role === 'doctor' && form.practitioner_types.length === 0) {
      setErrors({ practitioner_type: 'Veuillez choisir au moins une profession' })
      return
    }

    if (form.role === 'doctor' && form.practitioner_types.includes('autre') && !otherProfession.trim()) {
      setErrors({ practitioner_type: 'Veuillez préciser votre profession' })
      return
    }

    if (!acceptedTerms) {
      setErrors({ terms: 'Vous devez accepter les CGU et la politique de confidentialité' })
      return
    }

    if (form.role === 'doctor' && !acceptedEthicsCharter) {
      setErrors({ ethics: "Vous devez accepter l'engagement bien-être animal" })
      return
    }

    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) {
      setErrors({ captcha: 'Veuillez valider le contrôle de sécurité' })
      return
    }

    const result = schema.safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach(e => { errs[e.path[0]] = e.message })
      setErrors(errs); return
    }

    setLoading(true)
    // "Autre" reste une valeur fixe de la liste (practitioner_types garde
    // toujours 'autre', pour les filtres/services associés) — seul le
    // libellé affiché publiquement reprend la profession précisée en texte
    // libre, plutôt que le mot générique "Autre". Un praticien peut cumuler
    // plusieurs métiers (ex: éducateur canin ET naturopathe animalier).
    const specialties = form.practitioner_types
      .map(id => id === 'autre' ? otherProfession.trim() : PRACTITIONER_TYPES.find(p => p.id === id)?.label)
      .filter((label): label is string => !!label)

    let error: any
    let data: any
    try {
      ({ data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          captchaToken,
          data: {
            first_name:        form.first_name,
            last_name:         form.last_name,
            role:              form.role,
            specialty:         specialties[0] ?? '',
            specialties,
            terms_accepted:    acceptedTerms,
            ethics_charter_accepted: form.role === 'doctor' ? acceptedEthicsCharter : undefined,
          }
        }
      }))
    } catch (e: any) {
      // Sans ce try/catch, une coupure réseau/timeout laissait le bouton
      // bloqué sur "Création..." indéfiniment (setLoading(false) jamais
      // atteint) et le token Turnstile à usage unique jamais réinitialisé.
      setLoading(false)
      setGlobalError(`Erreur réseau : ${e.message}`)
      setCaptchaToken('')
      setTurnstileKey(k => k + 1)
      return
    }
    setLoading(false)
    if (error) {
      setGlobalError(error.message)
      // Un token Turnstile est à usage unique : sans ce reset, toute
      // nouvelle tentative échoue avec une erreur captcha, quelle que soit
      // la correction apportée au formulaire.
      setCaptchaToken('')
      setTurnstileKey(k => k + 1)
      return
    }
    // Repéré le 21/09/2026 (mari d'Anaïs jamais reçu son email d'activation
    // praticien) : par anti-énumération, Supabase ne renvoie PAS d'erreur
    // quand l'email existe déjà — error est null, un faux user est renvoyé,
    // et AUCUN email n'est envoyé. Le seul signal distinctif documenté est
    // un tableau `identities` vide sur ce faux user (un vrai nouvel
    // inscrit a toujours au moins une identité). Sans cette vérification,
    // l'écran affichait "Vérifiez votre email" à quelqu'un qui n'en
    // recevrait jamais aucun.
    if (data?.user && data.user.identities?.length === 0) {
      setGlobalError('Un compte existe déjà avec cet email. Essayez de vous connecter, ou de réinitialiser votre mot de passe si besoin.')
      setCaptchaToken('')
      setTurnstileKey(k => k + 1)
      return
    }
    try { localStorage.removeItem(REGISTER_DRAFT_KEY) } catch { /* best-effort */ }
    setSuccess(true)
  }

  if (success) return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4">
      <div className="card p-10 text-center max-w-md w-full">
        <div className="text-5xl mb-4">📬</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h2>
        <p className="text-gray-500 text-sm mb-6">
          Un lien de confirmation a été envoyé à <strong>{form.email}</strong>.
          Cliquez dessus pour activer votre compte.
        </p>
        <Link to="/login" className="btn-primary inline-block">Aller à la connexion</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex"><img src={logoNavbar} alt="Animéaux" className="h-10 w-auto" /></Link>
          <h1 className="text-xl font-bold text-gray-900 mt-4">Créer un compte</h1>
        </div>
        <div className="card p-8">

          {/* Type de compte */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            {(['patient', 'doctor'] as const).map(r => (
              <button key={r} type="button"
                onClick={() => setForm(f => ({ ...f, role: r, practitioner_types: [] }))}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                  ${form.role === r ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
                {r === 'patient' ? '🙋 Propriétaire' : '🩺 Praticien'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  className="input" placeholder="Marie" />
                {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  className="input" placeholder="Dupont" />
                {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
              </div>
            </div>

            {/* Choix du/des type(s) de praticien */}
            {form.role === 'doctor' && (
              <PractitionerTypePicker
                selectedIds={form.practitioner_types}
                onChange={ids => { setForm(f => ({ ...f, practitioner_types: ids })); setErrors(errs => ({ ...errs, practitioner_type: '' })) }}
                otherText={otherProfession}
                onOtherTextChange={text => { setOtherProfession(text); setErrors(errs => ({ ...errs, practitioner_type: '' })) }}
                error={errors.practitioner_type}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input" placeholder="vous@email.fr" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <PasswordInput value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 8 caractères" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms}
                  onChange={e => { setAcceptedTerms(e.target.checked); setErrors(errs => ({ ...errs, terms: '' })) }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500" />
                <span>
                  J'accepte les{' '}
                  <Link to="/cgu?from=register" target="_blank" className="text-sage-600 font-medium hover:underline">
                    Conditions Générales d'Utilisation
                  </Link>{' '}
                  et la{' '}
                  <Link to="/confidentialite?from=register" target="_blank" className="text-sage-600 font-medium hover:underline">
                    Politique de confidentialité
                  </Link>
                </span>
              </label>
              {errors.terms && <p className="text-red-500 text-xs mt-1">{errors.terms}</p>}
            </div>

            {form.role === 'doctor' && (
              <div>
                <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={acceptedEthicsCharter}
                    onChange={e => { setAcceptedEthicsCharter(e.target.checked); setErrors(errs => ({ ...errs, ethics: '' })) }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500" />
                  <span>
                    Je m'engage à respecter la{' '}
                    {/* Ouverture en fenêtre plutôt qu'un lien vers /engagement
                        (target="_blank" auparavant) : dans un navigateur
                        mobile ou la PWA installée, target="_blank" ne
                        garantit pas un vrai nouvel onglet — ça navigue dans
                        le même contexte, et "retour" ne restaure jamais le
                        formulaire déjà rempli (state local perdu au
                        démontage). Repéré par Anaïs le 21/09/2026 : elle
                        devait recommencer toute son inscription. */}
                    <button type="button" onClick={() => setShowCharterModal(true)}
                      className="text-sage-600 font-medium hover:underline">
                      Charte bien-être animal
                    </button>{' '}
                    d'Animéaux
                  </span>
                </label>
                {/* Résumé visible sans avoir à ouvrir la charte complète —
                    l'engagement ne doit pas rester une case cochée à
                    l'aveugle. */}
                <ul className="text-xs text-gray-400 list-disc list-inside mt-2 space-y-0.5 ml-1">
                  {ETHICS_CHARTER_CLAUSES.slice(0, 2).map(clause => <li key={clause}>{clause}</li>)}
                </ul>
                {errors.ethics && <p className="text-red-500 text-xs mt-1">{errors.ethics}</p>}
              </div>
            )}

            <div>
              <Turnstile key={turnstileKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
              {errors.captcha && <p className="text-red-500 text-xs mt-1">{errors.captcha}</p>}
            </div>

            {globalError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                {globalError}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-sage-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>

      {showCharterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCharterModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Charte bien-être animal</h2>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-2">
              {ETHICS_CHARTER_CLAUSES.map(clause => <li key={clause}>{clause}</li>)}
            </ul>
            <p className="text-xs text-gray-400 mt-4">{ETHICS_CHARTER_DISCLAIMER}</p>
            <button type="button" onClick={() => setShowCharterModal(false)} className="btn-primary w-full mt-6">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
