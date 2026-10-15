// src/components/ui/SubTabs.tsx
// Barre de sous-onglets d'une page (onglets Profil et Cabinet du praticien) : une ligne qui défile
// horizontalement sur téléphone, un onglet actif en couleur, navigation aux flèches du clavier.
import { useRef } from 'react'

export interface SubTabItem<T extends string> {
  id: T
  label: string
  // Petit nombre à droite du libellé (ex. nombre de praticiens)
  count?: number
}

interface Props<T extends string> {
  items: SubTabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
}

export default function SubTabs<T extends string>({ items, value, onChange, label }: Props<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    onChange(items[next].id)
    refs.current[items[next].id]?.focus()
  }

  return (
    <div role="tablist" aria-label={label}
      className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-sand-200 pb-2 mb-5">
      {items.map((item, i) => {
        const active = item.id === value
        return (
          <button key={item.id} role="tab" type="button" aria-selected={active} tabIndex={active ? 0 : -1}
            ref={el => { refs.current[item.id] = el }}
            onClick={() => onChange(item.id)} onKeyDown={e => onKeyDown(e, i)}
            className={`px-3 py-2 rounded-xl text-sm transition-colors flex-shrink-0 ${
              active ? 'bg-sage-50 text-sage-800 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}>
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 text-xs text-gray-400 font-normal">{item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
