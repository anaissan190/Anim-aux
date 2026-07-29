// src/pages/SearchPage.tsx
import { useSearchParams } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import SearchBar from '@/components/search/SearchBar'
import DoctorCard from '@/components/doctor/DoctorCard'
import ClinicCard from '@/components/doctor/ClinicCard'
import { useDoctors, useClinicsSearch, useNextAvailableSlots } from '@/hooks/useData'
import type { SearchFilters } from '@/types'
import { haversineKm } from '@/lib/geo'
import { PRACTICE_SPECIES_OPTIONS } from '@/lib/animalSpecies'

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
    species:   params.get('species') ? params.get('species')!.split(',') : undefined,
    homeVisit: params.get('homeVisit') === '1' ? true : undefined,
    availability: params.get('availability') === 'today' ? 'today' : params.get('availability') === 'week' ? 'week' : undefined,
  }
  const hasLocation = filters.lat !== undefined && filters.lng !== undefined
  // Sans spécialité, ville, géolocalisation ni filtre secondaire, il n'y a
  // aucun critère de recherche réel (prix/note seuls ne comptent pas, ils
  // affinent une recherche existante) : on n'interroge même pas la base,
  // pour ne jamais afficher "tout le monde" par défaut après une réinitialisation.
  const hasCriteria = !!(
    filters.specialty || filters.city || hasLocation ||
    (filters.species && filters.species.length > 0) ||
    filters.homeVisit || filters.availability
  )

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
    if (next.species && next.species.length > 0) p.set('species', next.species.join(','))
    if (next.homeVisit) p.set('homeVisit', '1')
    if (next.availability) p.set('availability', next.availability)
    setParams(p, { replace: true })
  }

  function toggleSpecies(id: string) {
    const current = filters.species ?? []
    const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id]
    updateFilters({ species: next.length > 0 ? next : undefined })
  }

  const { data: doctorsRaw = [], isLoading } = useDoctors(filters, hasCriteria)
  // Filtres prix/note ignorés côté cabinet : ils portent sur un praticien
  // précis, pas sur l'établissement dans son ensemble.
  const { data: clinicsRaw = [], isLoading: clinicsLoading } = useClinicsSearch(filters, hasCriteria)

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

  const doctorsWithDistance = withDistance(doctorsRaw)
  const clinics = withDistance(clinicsRaw)

  // Tri "Prochaine disponibilité" : optionnel, en plus du tri par défaut
  // (note/distance déjà appliqué par la requête et withDistance). Un
  // praticien sans créneau libre sur 30 jours passe en fin de liste plutôt
  // que d'être masqué.
  const sort = params.get('sort') === 'next_slot' ? 'next_slot' : 'pertinence'
  function setSort(next: string) {
    const p = new URLSearchParams(params)
    if (next === 'next_slot') p.set('sort', 'next_slot'); else p.delete('sort')
    setParams(p, { replace: true })
  }
  const { data: nextSlots = {} } = useNextAvailableSlots(
    sort === 'next_slot' ? doctorsWithDistance.map(d => d.id) : []
  )
  const doctors = sort === 'next_slot'
    ? [...doctorsWithDistance].sort((a, b) => {
        const sa = nextSlots[a.id], sb = nextSlots[b.id]
        if (!sa && !sb) return 0
        if (!sa) return 1
        if (!sb) return -1
        return new Date(sa).getTime() - new Date(sb).getTime()
      })
    : doctorsWithDistance

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="bg-white border-b py-4 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 [&>button]:mb-0">
          <BackButton fallback="/" />
          <div className="flex-1">
            <SearchBar initialSpecialty={filters.specialty} initialCity={filters.city} />
          </div>
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

            <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">Rayon autour de moi</label>
            <select value={filters.radiusKm ?? ''}
              disabled={!hasLocation}
              onChange={e => updateFilters({ radiusKm: e.target.value ? +e.target.value : undefined })}
              className="input text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">Toutes distances</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
            </select>
            {!hasLocation && (
              <p className="text-[11px] text-gray-400 mt-1">
                Clique sur 📍 dans le champ ville pour l'activer.
              </p>
            )}

            <div className="border-t border-dashed border-sage-200 my-3 pt-3">
              <p className="text-[10px] font-semibold text-sage-600 uppercase tracking-wide mb-2">Nouveau</p>

              <label className="block text-xs font-medium text-gray-500 mb-1.5">Espèces acceptées</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRACTICE_SPECIES_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => toggleSpecies(opt.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      (filters.species ?? []).includes(opt.id)
                        ? 'bg-sage-500 border-sage-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-sage-300'
                    }`}>
                    {opt.icon} {opt.id}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
                <input type="checkbox" checked={filters.homeVisit ?? false}
                  onChange={e => updateFilters({ homeVisit: e.target.checked ? true : undefined })}
                  className="accent-sage-500 w-4 h-4" />
                🏠 Se déplace à domicile
              </label>

              <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">📅 Disponibilité</label>
              <select value={filters.availability ?? ''}
                onChange={e => updateFilters({ availability: e.target.value ? e.target.value as 'today' | 'week' : undefined })}
                className="input text-sm py-2">
                <option value="">Peu importe</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Dans la semaine</option>
              </select>
            </div>

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
                    {!hasCriteria ? '' : loading ? 'Recherche...' : `${total} résultat${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`}
                  </p>
                  {hasCriteria && doctors.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-500">
                      Trier par
                      <select value={sort} onChange={e => setSort(e.target.value)}
                        className="input text-sm py-1.5">
                        <option value="pertinence">Pertinence</option>
                        <option value="next_slot">Prochaine disponibilité</option>
                      </select>
                    </label>
                  )}
                </div>

                {!hasCriteria ? (
                  <div className="card p-12 text-center">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="font-semibold text-gray-900 mb-2">Lancez une recherche</h3>
                    <p className="text-sm text-gray-500">Saisissez une spécialité, une ville, ou utilisez la géolocalisation.</p>
                  </div>
                ) : loading ? (
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
                        {doctors.map(d => <DoctorCard key={d.id} doctor={d} distanceKm={d.distanceKm} nextSlotAt={nextSlots[d.id]} />)}
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
