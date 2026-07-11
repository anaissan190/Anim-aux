// src/pages/SearchPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import SearchBar from '@/components/search/SearchBar'
import DoctorCard from '@/components/doctor/DoctorCard'
import ClinicCard from '@/components/doctor/ClinicCard'
import { useDoctors, useClinicsSearch } from '@/hooks/useData'
import type { SearchFilters } from '@/types'

export default function SearchPage() {
  const [params] = useSearchParams()
  const initializedRef = useRef(false)

  const [filters, setFilters] = useState<SearchFilters>({
    specialty: params.get('specialty') ?? '',
    city:      params.get('city') ?? '',
    maxPrice:  undefined,
    minRating: undefined,
  })

  const { data: doctors = [], isLoading } = useDoctors(filters)
  // Filtres prix/note ignorés côté cabinet : ils portent sur un praticien
  // précis, pas sur l'établissement dans son ensemble.
  const { data: clinics = [], isLoading: clinicsLoading } = useClinicsSearch(filters)

  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return }
    setFilters(f => ({
      ...f,
      specialty: params.get('specialty') ?? '',
      city:      params.get('city') ?? '',
    }))
  }, [params])

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="bg-white border-b py-4 px-4">
        <div className="max-w-5xl mx-auto">
          <SearchBar />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6">
        {/* Filtres latéraux */}
        <aside className="hidden md:block w-56 flex-shrink-0 space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Filtres</h3>

            <label className="block text-xs font-medium text-gray-500 mb-1">Prix max (€)</label>
            <input type="number" min={0} max={500}
              value={filters.maxPrice ?? ''}
              onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value ? +e.target.value : undefined }))}
              className="input text-sm py-2" placeholder="Tous les prix" />

            <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">Note minimum</label>
            <select value={filters.minRating ?? ''}
              onChange={e => setFilters(f => ({ ...f, minRating: e.target.value ? +e.target.value : undefined }))}
              className="input text-sm py-2">
              <option value="">Toutes les notes</option>
              <option value="4">4+ étoiles</option>
              <option value="4.5">4.5+ étoiles</option>
            </select>

            <button onClick={() => setFilters({ specialty: '', city: '', maxPrice: undefined, minRating: undefined })}
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
                        {clinics.map((c: any) => <ClinicCard key={c.id} clinic={c} />)}
                      </div>
                    )}
                    {doctors.length > 0 && (
                      <div className="space-y-3">
                        {clinics.length > 0 && (
                          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Praticiens</h2>
                        )}
                        {doctors.map(d => <DoctorCard key={d.id} doctor={d} />)}
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
