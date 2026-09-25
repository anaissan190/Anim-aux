// src/lib/onboardingTour.ts
// Logique pure de la visite guidée de première connexion (composant :
// components/onboarding/OnboardingTour.tsx). Tout ce qui se calcule sans
// DOM vit ici pour être testable : contenu par rôle, règle d'affichage,
// filtrage des étapes, et géométrie (bulle + flèche + cercle).

export type TourRole = 'patient' | 'doctor'

// `key` = valeur de l'attribut data-tour posé sur le vrai bouton (Navbar,
// MobileHeader, MobileTabBar, DoctorMobileTabBar). Le même key existe sur la
// barre bureau ET la barre mobile : le composant prend le premier élément
// réellement visible, ce qui gère les deux mises en page sans cas particulier.
export interface TourStep {
  key: string
  title: string
  body: string
}

const PATIENT_STEPS: TourStep[] = [
  { key: 'notifications', title: 'Vos notifications', body: 'Rappels de vaccin, confirmations de rendez-vous : tout arrive ici.' },
  { key: 'messages', title: 'Vos messages', body: 'Écrivez directement à votre praticien.' },
  { key: 'patient-tab:/animaux', title: 'Mes animaux', body: 'Le carnet de santé de chaque animal : vaccins, poids, documents.' },
  { key: 'book', title: 'Prendre rendez-vous', body: 'Trouvez un praticien près de chez vous et réservez en quelques clics.' },
  { key: 'patient-tab:/rendez-vous', title: 'Mes rendez-vous', body: 'Consultez, déplacez ou annulez vos rendez-vous à venir.' },
  { key: 'patient-tab:/documents', title: 'Vos documents', body: 'Ordonnances, comptes rendus et autres pièces, rangés au même endroit.' },
  { key: 'profile', title: 'Votre profil', body: 'Vos coordonnées, vos notifications et vos réglages.' },
]

const DOCTOR_STEPS: TourStep[] = [
  { key: 'doctor-tab:home', title: 'Mon espace', body: 'Votre journée d’un coup d’œil : prochains rendez-vous et alertes.' },
  { key: 'doctor-tab:patients', title: 'Mes patients', body: 'Les dossiers des animaux que vous suivez, avec leur historique.' },
  { key: 'doctor-tab:disponibilites', title: 'Vos rendez-vous', body: 'Agenda du jour, et réglage de vos horaires de disponibilité.' },
  { key: 'notifications', title: 'Notifications', body: 'Nouvelles demandes de rendez-vous, messages et partages de dossiers.' },
  { key: 'messages', title: 'Vos messages', body: 'Échangez avec vos patients, sans quitter l’application.' },
  { key: 'profile', title: 'Votre profil', body: 'Vos métiers, votre photo, vos tarifs et l’activation de la messagerie.' },
]

export function getTourSteps(role: TourRole): TourStep[] {
  return role === 'doctor' ? DOCTOR_STEPS : PATIENT_STEPS
}

// Routes où la première connexion atterrit (voir LoginPage / HomeRoute) et où
// les boutons ciblés existent tous.
const TOUR_PATHS: Record<TourRole, string> = {
  patient: '/dashboard/patient',
  doctor: '/dashboard/doctor',
}

interface ShouldShowInput {
  role: string | undefined
  isAdmin: boolean | undefined
  // `undefined` = profil en cache d'avant la migration 110 (colonne inconnue)
  // ou pas encore chargé : on ne sait pas → on n'affiche rien. Seul `null`
  // (colonne connue, jamais renseignée) déclenche le tuto.
  onboardingCompletedAt: string | null | undefined
  pathname: string
}

export function shouldShowTour({ role, isAdmin, onboardingCompletedAt, pathname }: ShouldShowInput): TourRole | null {
  if (isAdmin) return null
  if (role !== 'patient' && role !== 'doctor') return null
  if (onboardingCompletedAt !== null) return null
  return pathname === TOUR_PATHS[role] ? role : null
}

// Ne garde que les étapes dont le bouton est réellement visible à l'écran
// (barre mobile vs bureau, cabinet, etc.).
export function pickVisibleSteps<T extends { key: string }>(steps: T[], isVisible: (key: string) => boolean): T[] {
  return steps.filter(s => isVisible(s.key))
}

// --- Géométrie ---------------------------------------------------------

export interface Rect { left: number; top: number; width: number; height: number }
export interface Point { x: number; y: number }

export interface TourGeometry {
  bubbleLeft: number
  bubbleTop: number
  bubbleWidth: number
  // Cercle dessiné à main levée autour du bouton
  ring: { cx: number; cy: number; rx: number; ry: number }
  // Courbe de la flèche (cubique) et pointe (3 points)
  arrow: { start: Point; c1: Point; c2: Point; end: Point }
  head: [Point, Point, Point]
  // La bulle est-elle au-dessus du bouton ?
  above: boolean
}

const GAP = 78
const MARGIN = 16

export function computeTourGeometry(target: Rect, viewport: { width: number; height: number }, bubbleHeight: number): TourGeometry {
  const bubbleWidth = Math.min(viewport.width - 2 * MARGIN, 300)
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2
  const bubbleLeft = Math.max(MARGIN, Math.min(cx - bubbleWidth / 2, viewport.width - MARGIN - bubbleWidth))

  const above = target.top > viewport.height / 2
  const rawTop = above ? target.top - GAP - bubbleHeight : target.top + target.height + GAP
  const bubbleTop = Math.max(8, Math.min(rawTop, viewport.height - 8 - bubbleHeight))

  const rx = Math.max(target.width / 2 + 9, 20)
  const ry = target.height / 2 + 8
  const ring = { cx, cy, rx, ry }

  // La flèche part du bord de la bulle le plus proche du bouton, avec un
  // décalage latéral (signe selon le côté de l'écran) pour qu'elle ondule au
  // lieu de tomber droit.
  const side = cx < viewport.width / 2 ? 1 : -1
  const dir = above ? 1 : -1
  const start = {
    x: Math.max(bubbleLeft + 26, Math.min(cx + side * 70, bubbleLeft + bubbleWidth - 26)),
    y: above ? bubbleTop + bubbleHeight + 4 : bubbleTop - 4,
  }
  const end = { x: cx - side * 4, y: above ? cy - ry - 4 : cy + ry + 4 }
  const c1 = { x: start.x + side * 30, y: start.y + dir * 30 }
  const c2 = { x: end.x - side * 46, y: end.y - dir * 38 }

  // Pointe de flèche : deux branches légèrement asymétriques (aspect croqué)
  const angle = Math.atan2(end.y - c2.y, end.x - c2.x)
  const branch = (a: number, len: number): Point => ({ x: end.x + len * Math.cos(a), y: end.y + len * Math.sin(a) })
  const head: [Point, Point, Point] = [branch(angle + 2.7, 12), end, branch(angle - 2.55, 9.5)]

  return { bubbleLeft, bubbleTop, bubbleWidth, ring, arrow: { start, c1, c2, end }, head, above }
}

const f = (n: number) => n.toFixed(1)

export function arrowPath({ start, c1, c2, end }: TourGeometry['arrow']): string {
  return `M${f(start.x)} ${f(start.y)} C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(end.x)} ${f(end.y)}`
}

export function headPath(head: TourGeometry['head']): string {
  return `M${f(head[0].x)} ${f(head[0].y)} L${f(head[1].x)} ${f(head[1].y)} L${f(head[2].x)} ${f(head[2].y)}`
}

// Cercle "au crayon" : un peu plus d'un tour, avec un léger dépassement et un
// rayon qui grandit et ondule, pour qu'il ne ressemble pas à une ellipse CSS.
export function scribblePath({ cx, cy, rx, ry }: TourGeometry['ring']): string {
  const steps = 44
  const start = -2.5
  const sweep = 2 * Math.PI + 0.7
  let d = ''
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    const a = start + t * sweep
    const q = 1 + 0.05 * Math.sin(t * 7) + 0.09 * t
    const x = cx + rx * q * Math.cos(a)
    const y = cy + ry * q * Math.sin(a) - 2 * t
    d += `${k === 0 ? 'M' : ' L'}${f(x)} ${f(y)}`
  }
  return d
}
