// src/components/ui/StarRating.tsx
interface Props {
  rating: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (rating: number) => void
}

const STAR_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"

export default function StarRating({ rating, max = 5, size = 'md', interactive, onChange }: Props) {
  const sizes = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-6 h-6' }
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        // En mode interactif (choix d'une note entière par clic), pas de
        // demi-étoile : chaque étoile est pleine ou vide selon la note
        // choisie. En affichage (moyenne des avis), l'étoile se remplit au
        // prorata — ex: note de 3,5 → 3 étoiles pleines + la 4e à moitié.
        const fillPercent = interactive
          ? (i < Math.round(rating) ? 100 : 0)
          : Math.max(0, Math.min(1, rating - i)) * 100

        return (
          <div key={i}
            className={`relative ${sizes[size]} flex-shrink-0 ${interactive ? 'cursor-pointer' : ''}`}
            onClick={() => interactive && onChange?.(i + 1)}
          >
            <svg className={`${sizes[size]} text-gray-200 absolute inset-0`} fill="currentColor" viewBox="0 0 20 20">
              <path d={STAR_PATH} />
            </svg>
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <svg
                className={`${sizes[size]} text-amber-400 ${interactive ? 'hover:text-amber-300 transition-colors' : ''}`}
                fill="currentColor" viewBox="0 0 20 20"
              >
                <path d={STAR_PATH} />
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}
