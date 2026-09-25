// src/components/onboarding/OnboardingTour.tsx
// Visite guidée de première connexion : un cercle "au crayon" autour du vrai
// bouton, une flèche courbe jusqu'à une bulle qui l'explique. Monté une seule
// fois dans App.tsx. Ne s'affiche que pour un patient ou un praticien dont le
// profil a onboarding_completed_at = null (migration 110), sur son tableau de
// bord, et une seule fois : terminer OU fermer la visite marque le tuto comme
// vu (pas de bouton "revoir" — décision d'Anaïs).
//
// Les boutons ciblés portent un attribut data-tour (voir Navbar, MobileHeader,
// MobileTabBar, DoctorMobileTabBar). Le même data-tour existe sur la barre
// bureau ET la barre mobile : on prend le premier élément réellement visible.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { useCompleteOnboarding } from '@/hooks/useData'
import {
  getTourSteps, shouldShowTour, pickVisibleSteps, computeTourGeometry,
  arrowPath, headPath, scribblePath, type Rect, type TourStep,
} from '@/lib/onboardingTour'

function findVisibleTarget(key: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    if (el.getClientRects().length > 0 && r.width > 0 && r.height > 0) return el
  }
  return null
}

const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, width: r.width, height: r.height })

export default function OnboardingTour() {
  const { user, profile } = useAuthStore()
  const location = useLocation()
  const complete = useCompleteOnboarding()

  const role = shouldShowTour({
    role: user?.role,
    isAdmin: user?.is_admin,
    onboardingCompletedAt: profile?.onboarding_completed_at,
    pathname: location.pathname,
  })

  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)

  // Attend que les boutons soient affichés (le tableau de bord praticien met
  // un moment à se monter). Si rien n'apparaît (praticien encore bloqué sur
  // l'écran de dépôt de document, par ex.), on n'affiche rien et on ne marque
  // PAS le tuto comme vu : il se lancera à la première arrivée sur le vrai
  // tableau de bord.
  useEffect(() => {
    if (!role) { setSteps(null); return }
    let cancelled = false
    let tries = 0
    const timer = setInterval(() => {
      tries++
      const visible = pickVisibleSteps(getTourSteps(role), k => findVisibleTarget(k) !== null)
      if (visible.length >= 2) {
        clearInterval(timer)
        // Petit délai : laisse l'écran de démarrage/les animations d'entrée finir.
        setTimeout(() => { if (!cancelled) { setIndex(0); setSteps(visible) } }, 700)
      } else if (tries >= 40) {
        clearInterval(timer)
      }
    }, 300)
    return () => { cancelled = true; clearInterval(timer) }
  }, [role])

  const finish = useCallback(() => {
    setSteps(null)
    complete.mutate()
  }, [complete])

  if (!role || !steps || steps.length === 0) return null
  return createPortal(<Tour steps={steps} index={index} setIndex={setIndex} onFinish={finish} />, document.body)
}

function Tour({ steps, index, setIndex, onFinish }: {
  steps: TourStep[]
  index: number
  setIndex: (i: number) => void
  onFinish: () => void
}) {
  const step = steps[index]
  const isLast = index === steps.length - 1
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [bubbleHeight, setBubbleHeight] = useState(160)

  const measure = useCallback(() => {
    const el = findVisibleTarget(step.key)
    if (!el) return
    setRect(toRect(el.getBoundingClientRect()))
    setViewport({ width: window.innerWidth, height: window.innerHeight })
  }, [step.key])

  // Amène la cible à l'écran puis mesure ; re-mesure au scroll / redimensionnement.
  useLayoutEffect(() => {
    findVisibleTarget(step.key)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.key, measure])

  useLayoutEffect(() => {
    if (bubbleRef.current) setBubbleHeight(bubbleRef.current.offsetHeight)
  }, [index, viewport.width])

  // Clavier : flèches pour naviguer, Échap pour fermer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish()
      else if (e.key === 'ArrowRight') { if (isLast) onFinish(); else setIndex(index + 1) }
      else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, isLast, onFinish, setIndex])

  const geo = useMemo(
    () => (rect ? computeTourGeometry(rect, viewport, bubbleHeight) : null),
    [rect, viewport, bubbleHeight],
  )
  if (!rect || !geo) return null
  const pad = 4

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="Visite guidée de l'application">
      {/* Zone qui capture les clics : on ne peut pas actionner l'interface pendant la visite. */}
      <div className="absolute inset-0" />
      {/* Découpe éclairée autour du bouton, le reste de l'écran est assombri. */}
      <div
        className="absolute rounded-2xl pointer-events-none transition-all duration-300"
        style={{
          left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad,
          boxShadow: '0 0 0 9999px rgba(40,30,20,0.66)',
        }}
      />
      {/* key={index} : redémarre l'animation de tracé à chaque étape. */}
      <svg key={index} className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }} aria-hidden="true">
        <path className="tour-line tour-ring" pathLength={1} d={scribblePath(geo.ring)} />
        <path className="tour-line tour-arrow" pathLength={1} d={arrowPath(geo.arrow)} />
        <path className="tour-head" d={headPath(geo.head)} />
      </svg>

      <div
        key={`b${index}`}
        ref={bubbleRef}
        className="tour-bubble absolute bg-white rounded-[18px] border border-sand-200 shadow-2xl pt-4 pb-3 pl-5 pr-4"
        style={{ left: geo.bubbleLeft, top: geo.bubbleTop, width: geo.bubbleWidth }}
      >
        <button onClick={onFinish} aria-label="Fermer la visite"
          className="absolute right-2 top-1.5 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg leading-none">
          ×
        </button>
        <p className="font-serif italic font-medium text-[17px] text-gray-900 mb-1 pr-6">{step.title}</p>
        <p className="text-[12.5px] leading-relaxed text-gray-500">{step.body}</p>

        <div className="flex items-center justify-center gap-[5px] mt-3" aria-label={`Étape ${index + 1} sur ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i}
              className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-sage-600' : 'w-1.5 bg-sand-200'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-dashed border-sand-200">
          <button onClick={() => setIndex(index - 1)}
            className={`text-[12.5px] text-gray-500 hover:text-gray-700 ${index === 0 ? 'invisible' : ''}`}>
            ← Précédent
          </button>
          <button onClick={() => (isLast ? onFinish() : setIndex(index + 1))}
            className="bg-sage-600 hover:bg-sage-700 text-white rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors">
            {isLast ? 'Terminer' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  )
}
