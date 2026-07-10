// src/components/ui/SpeciesSelect.tsx
import { useEffect, useRef, useState } from 'react'
import { SPECIES_GROUPS } from '@/lib/animalSpecies'

interface Props {
  value: string
  onChange: (species: string) => void
  className?: string
}

export default function SpeciesSelect({ value, onChange, className }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Referme le menu si on clique en dehors, et remet l'affichage sur la
  // valeur sélectionnée (sans garder une recherche en cours affichée).
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const q = query.trim().toLowerCase()
  const filteredGroups = SPECIES_GROUPS
    .map(g => ({ ...g, species: g.species.filter(s => s.name.toLowerCase().includes(q)) }))
    .filter(g => g.species.length > 0)

  function select(name: string) {
    onChange(name)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className={`relative ${className ?? ''}`} ref={wrapRef}>
      <input
        className="input text-sm mt-1"
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={e => { setOpen(true); setQuery(''); e.target.select() }}
        placeholder="Rechercher une espèce..."
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {filteredGroups.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">Aucune espèce trouvée.</p>
          ) : (
            filteredGroups.map(g => (
              <div key={g.group}>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 px-3 pt-2 pb-1">{g.group}</p>
                {g.species.map(s => (
                  <button key={s.name} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => select(s.name)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-sage-50 ${value === s.name ? 'text-sage-700 font-medium' : 'text-gray-700'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            ))
          )}
          <button type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => select('Autre')}
            className={`w-full text-left px-3 py-1.5 text-sm border-t border-gray-100 hover:bg-sage-50 ${value === 'Autre' ? 'text-sage-700 font-medium' : 'text-gray-700'}`}>
            Autre...
          </button>
        </div>
      )}
    </div>
  )
}
