// src/lib/searchMap.ts
// Points affichés sur la carte de la page de recherche (/search?view=map) :
// praticiens et cabinets qui ont des coordonnées. Logique pure (testée) ; le
// composant Leaflet est dans components/search/SearchResultsMap.tsx.
import { formatDoctorName } from './practitionerTypes'

export interface MapPoint {
  key: string
  kind: 'doctor' | 'clinic'
  lat: number
  lng: number
  title: string
  subtitle: string
  href: string
}

interface DoctorLike {
  id: string
  lat?: number | null
  lng?: number | null
  city?: string | null
  specialties?: string[] | null
  profiles?: { first_name?: string | null; last_name?: string | null } | null
}

interface ClinicLike {
  id: string
  name: string
  lat?: number | null
  lng?: number | null
  city?: string | null
}

const hasCoords = (x: { lat?: number | null; lng?: number | null }): x is { lat: number; lng: number } =>
  typeof x.lat === 'number' && typeof x.lng === 'number' && Number.isFinite(x.lat) && Number.isFinite(x.lng)

// `withoutCoordinates` : résultats trouvés mais impossibles à placer (adresse
// pas encore géocodée) — signalés à l'utilisateur plutôt que silencieusement
// absents de la carte.
export function buildMapPoints(doctors: DoctorLike[], clinics: ClinicLike[]): { points: MapPoint[]; withoutCoordinates: number } {
  const points: MapPoint[] = []
  let withoutCoordinates = 0

  for (const c of clinics) {
    if (!hasCoords(c)) { withoutCoordinates++; continue }
    points.push({ key: `clinic-${c.id}`, kind: 'clinic', lat: c.lat, lng: c.lng, title: c.name, subtitle: c.city ?? 'Cabinet', href: `/cabinet/${c.id}` })
  }
  for (const d of doctors) {
    if (!hasCoords(d)) { withoutCoordinates++; continue }
    const name = formatDoctorName(d.specialties, d.profiles?.first_name, d.profiles?.last_name).trim()
    const subtitle = [(d.specialties ?? []).join(' · '), d.city].filter(Boolean).join(' — ')
    points.push({ key: `doctor-${d.id}`, kind: 'doctor', lat: d.lat, lng: d.lng, title: name || 'Praticien', subtitle, href: `/doctor/${d.id}` })
  }
  return { points, withoutCoordinates }
}
