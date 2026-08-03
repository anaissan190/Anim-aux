// src/components/mobile/CatMascot.tsx
// Mascotte chat de la refonte mobile — silhouette simple, en attendant les
// vraies illustrations des deux chats de la cliente (à intégrer plus tard).
type Props = {
  size?: number
  animate?: boolean
  className?: string
}

export default function CatMascot({ size = 72, animate = false, className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`${animate ? 'animate-cat-bob' : ''} ${className}`}
    >
      <path d="M25 35 L15 5 L45 25 Z" className="fill-sage-500" />
      <path d="M95 35 L105 5 L75 25 Z" className="fill-sage-500" />
      <path d="M28 30 L23 14 L38 26 Z" className="fill-sage-100" />
      <path d="M92 30 L97 14 L82 26 Z" className="fill-sage-100" />
      <circle cx="60" cy="62" r="38" className="fill-sage-500" />
      <ellipse cx="60" cy="74" rx="20" ry="14" fill="#fff" />
      <circle cx="47" cy="60" r="4.5" className="fill-gray-900" />
      <circle cx="73" cy="60" r="4.5" className="fill-gray-900" />
      <path d="M56 70 L64 70 L60 76 Z" className="fill-moss-700" />
      <path d="M60 76 Q 52 84 44 78" stroke="currentColor" className="text-gray-900" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M60 76 Q 68 84 76 78" stroke="currentColor" className="text-gray-900" strokeWidth="2" fill="none" strokeLinecap="round" />
      <g stroke="currentColor" className="text-gray-900" strokeWidth="1.5" strokeLinecap="round" opacity=".45">
        <line x1="18" y1="68" x2="42" y2="70" />
        <line x1="18" y1="76" x2="42" y2="76" />
        <line x1="102" y1="68" x2="78" y2="70" />
        <line x1="102" y1="76" x2="78" y2="76" />
      </g>
    </svg>
  )
}
