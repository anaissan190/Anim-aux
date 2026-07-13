// src/components/search/SearchBar.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSpecialties } from '@/hooks/useData'

interface Props { large?: boolean; initialSpecialty?: string; initialCity?: string }

export default function SearchBar({ large, initialSpecialty = '', initialCity = '' }: Props) {
  const navigate = useNavigate()
  // Sert uniquement à préserver les autres filtres déjà actifs (prix, note)
  // quand on relance une recherche par spécialité/ville depuis cette barre —
  // sur la page d'accueil, il n'y a jamais de tels paramètres à préserver.
  const [currentParams] = useSearchParams()
  const { data: specialties = [] } = useSpecialties()
  const [specialty, setSpecialty] = useState(initialSpecialty)
  const [city, setCity] = useState(initialCity)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const specialtiesRef = useRef<string[]>([])

  // Reflète le filtre actif — utile quand on revient sur /search (retour
  // depuis une fiche praticien) ou après un reset des filtres latéraux :
  // la barre ne doit pas paraître vide alors que le filtre est toujours
  // appliqué.
  useEffect(() => {
    setSpecialty(initialSpecialty)
  }, [initialSpecialty])
  useEffect(() => {
    setCity(initialCity)
  }, [initialCity])

  useEffect(() => {
    specialtiesRef.current = specialties
  }, [specialties])

  const updateSuggestions = useCallback((value: string) => {
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const filtered = specialtiesRef.current.filter(s =>
      s.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 6)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams(currentParams)
    if (specialty) p.set('specialty', specialty); else p.delete('specialty')
    if (city) p.set('city', city); else p.delete('city')
    p.delete('lat'); p.delete('lng'); p.delete('radiusKm')
    navigate(`/search?${p.toString()}`)
  }

  function handleLocate() {
    setGeoError('')
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas prise en charge par ce navigateur.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        setCity('')
        const p = new URLSearchParams(currentParams)
        if (specialty) p.set('specialty', specialty); else p.delete('specialty')
        p.delete('city')
        p.set('lat', String(pos.coords.latitude))
        p.set('lng', String(pos.coords.longitude))
        navigate(`/search?${p.toString()}`)
      },
      () => {
        setLocating(false)
        setGeoError('Impossible de récupérer votre position. Vérifiez les autorisations de localisation de votre navigateur.')
      },
      { timeout: 10000 }
    )
  }

  return (
    <form onSubmit={handleSearch} className={`flex flex-col sm:flex-row gap-2 w-full ${large ? 'max-w-2xl' : 'max-w-xl'}`}>
      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          value={specialty}
          onChange={e => { setSpecialty(e.target.value); updateSuggestions(e.target.value) }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Spécialité, praticien..."
          className={`input pl-9 ${large ? 'py-4 text-base' : ''}`}
        />
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 card shadow-lg z-50 overflow-hidden">
            {suggestions.map(s => (
              <button key={s} type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-sage-50 transition-colors"
                onClick={() => { setSpecialty(s); setShowSuggestions(false) }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        </div>
        <input
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder="Ville"
          className={`input pl-9 pr-10 ${large ? 'py-4 text-base' : ''}`}
        />
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          title="Autour de moi"
          aria-label="Utiliser ma position actuelle"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-sage-600 disabled:opacity-50"
        >
          {locating ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          )}
        </button>
        {geoError && (
          <p className="absolute top-full left-0 mt-1 text-xs text-red-500 max-w-xs">{geoError}</p>
        )}
      </div>

      <button type="submit" className={`btn-primary whitespace-nowrap ${large ? 'py-4 px-8 text-base' : ''}`}>
        Rechercher
      </button>
    </form>
  )
}
