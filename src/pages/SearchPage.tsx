// src/pages/SearchPage.tsx
import { useSearchParams } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import SearchBar from '@/components/search/SearchBar'
import DoctorCard from '@/components/doctor/DoctorCard'
import ClinicCard from '@/components/doctor/ClinicCard'
import { useDoctors, useClinicsSearch } from '@/hooks/useData'
import type { SearchFilters } from '@/types'
import { haversineKm } from '@/lib/geo'

export default function SearchPage() {
  // L'URL est l'unique source de vérité pour les filtres (specialty, city,
  // maxPrice, minRating) — plus de state React dupliqué. Comme ça, un
  // retour arrière depuis une fiche praticien restaure exactement l'URL
  // précédente (donc tous les filtres), sans dépendre d'un state local
  // remis à zéro au remount.
  const [params, setParams] = useSearchParams()

  const filters: SearchFilters = {
    specialty: params.get('specialty') ?? '',
    city:      params.get('city') ?? '',
    maxPrice:  params.get('maxPrice') ? +params.get('maxPrice')! : undefined,
    minRating: params.get('minRating') ? +params.get('minRating')! : undefined,
    lat:       params.get('lat') ? +params.get('lat')! : undefined,
    lng:       params.get('lng') ? +params.get('lng')! : undefined,
    radiusKm:  params.get('radiusKm') ? +params.get('radiusKm')! : undefined,
  }
  const hasLocation = filters.lat !== undefined && filters.lng !== undefined

  function updateFilters(patch: Partial<SearchFilters>) {
    const next = { ...filters, ...patch }
    const p = new URLSearchParams()
    if (next.specialty) p.set('specialty', next.specialty)
    if (next.city) p.set('city', next.city)
    if (next.maxPrice !== undefined) p.set('maxPrice', String(next.maxPrice))
    if (next.minRating !== undefined) p.set('minRating', String(next.minRating))
    if (next.lat !== undefined) p.set('lat', String(next.lat))
    if (next.lng !== undefined) p.set('lng', String(next.lng))
    if (next.radiusKm !== undefined) p.set('radiusKm', String(next.radiusKm))
    setParams(p, { replace: true })
  }

  const { data: doctorsRaw = [], isLoading } = useDoctors(filters)
  // Filtres prix/note ignorés côté cabinet : ils portent sur un praticien
  // précis, pas sur l'établissement dans son ensemble.
  const { data: clinicsRaw = [], isLoading: clinicsLoading } = useClinicsSearch(filters)

  // Tri/filtre par distance : calculé côté client (à vol d'oiseau) une fois
  // qu'une position est active. Les entrées sans coordonnées (praticien pas
  // encore geocodé) restent affichées en fin de liste, sauf si un rayon
  // précis est demandé — on ne peut alors pas garantir qu'elles y soient.
  function withDistance<T extends { lat?: number | null; lng?: number | null }>(items: T[]): (T & { distanceKm?: number })[] {
    if (!hasLocation) return items
    const withD = items.map(item => ({
      ...item,
      distanceKm: item.lat != null && item.lng != null
        ? haversineKm(filters.lat!, filters.lng!, item.lat, item.lng)
        : undefined,
    }))
    const filtered = filters.radiusKm !== undefined
      ? withD.filter(item => item.distanceKm !== undefined && item.distanceKm <= filters.radiusKm!)
      : withD
    return filtered.sort((a, b) => {
      if (a.distanceKm === undefined) return 1
      if (b.distanceKm === undefined) return -1
      return a.distanceKm - b.distanceKm
    })
  }

  const doctors = withDistance(doctorsRaw)
  const clinics = withDistance(clinicsRaw)

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="bg-white border-b py-4 px-4">
        <div className="max-w-5xl mx-auto">
          <SearchBar initialSpecialty={filters.specialty} initialCity={filters.city} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6">
        {/* Filtres latéraux */}
        <aside className="hidden md:block w-56 flex-shrink-0 space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Filtres</h3>

            <label className="block text-xs font-medium text-gray-500 mb-1">Prix max</label>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] text-gray-400">0 €</span>
              <span className="text-sm font-medium text-sage-500">
                {filters.maxPrice === undefined ? '200 €+' : `${filters.maxPrice} €`}
              </span>
              <span className="text-[11px] text-gray-400">200 €+</span>
            </div>
            <input type="range" min={0} max={200} step={10}
              value={filters.maxPrice ?? 200}
              onChange={e => {
                const v = +e.target.value
                updateFilters({ maxPrice: v >= 200 ? undefined : v })
              }}
              className="w-full accent-sage-500 mb-2" />

            <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">Note minimum</label>
            <select value={filters.minRating ?? ''}
              onChange={e => updateFilters({ minRating: e.target.value ? +e.target.value : undefined })}
              className="input text-sm py-2">
              <option value="">Toutes les notes</option>
              <option value="4">4+ étoiles</option>
              <option value="4.5">4.5+ étoiles</option>
            </select>

            {hasLocation && (
              <>
                <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">Rayon autour de moi</label>
                <select value={filters.radiusKm ?? ''}
                  onChange={e => updateFilters({ radiusKm: e.target.value ? +e.target.value : undefined })}
                  className="input text-sm py-2">
                  <option value="">Toutes distances</option>
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="25">25 km</option>
                  <option value="50">50 km</option>
                  <option value="100">100 km</option>
                </select>
              </>
            )}

            <button onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="btn-secondary w-full text-sm py-2 mt-3">
              Réinitialiser
            </button>
          </div>
        </aside>

        {/* Résultats */}
        <main className="flex-1">
          {(() => {
            const loading = isLoading || clinicsLoading
            const total = doctors.length + clinics.length
            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    {loading ? 'Recherche...' : `${total} résultat${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`}
                  </p>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="card p-5 flex gap-4 animate-pulse">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-100 rounded w-1/3" />
                          <div className="h-3 bg-gray-100 rounded w-1/4" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : total === 0 ? (
                  <div className="card p-12 text-center">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="font-semibold text-gray-900 mb-2">Aucun résultat</h3>
                    <p className="text-sm text-gray-500">Essayez de modifier vos critères de recherche.</p>
                  </div>
                ) : (
                  <>
                    {clinics.length > 0 && (
                      <div className="space-y-3 mb-6">
                        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cabinets</h2>
                        {clinics.map((c: any) => <ClinicCard key={c.id} clinic={c} distanceKm={c.distanceKm} />)}
                      </div>
                    )}
                    {doctors.length > 0 && (
                      <div className="space-y-3">
                        {clinics.length > 0 && (
                          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Praticiens</h2>
                        )}
                        {doctors.map(d => <DoctorCard key={d.id} doctor={d} distanceKm={d.distanceKm} />)}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </main>
      </div>
    </div>
  )
}
