// src/pages/LogoPreview.tsx

// Patte de chien (pad rond + 4 coussinets ronds)
function DogPaw({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <ellipse cx="0" cy="2.5" rx="4" ry="4.5" fill={color} />
      <circle cx="-3.2" cy="-2" r="2.2" fill={color} />
      <circle cx="3.2" cy="-2" r="2.2" fill={color} />
      <circle cx="-1.2" cy="-5" r="2" fill={color} />
      <circle cx="1.2" cy="-5" r="2" fill={color} />
    </g>
  )
}

// Patte de chat (coussinets plus fins, griffes)
function CatPaw({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <ellipse cx="0" cy="2" rx="3.5" ry="4" fill={color} />
      <ellipse cx="-3" cy="-2" rx="1.8" ry="2.2" fill={color} />
      <ellipse cx="3" cy="-2" rx="1.8" ry="2.2" fill={color} />
      <ellipse cx="-1" cy="-4.8" rx="1.6" ry="2" fill={color} />
      <ellipse cx="1" cy="-4.8" rx="1.6" ry="2" fill={color} />
      {/* Griffes */}
      <line x1="-3" y1="-4" x2="-3.5" y2="-7" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="0" y1="-7" x2="0" y2="-9.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="3" y1="-4" x2="3.5" y2="-7" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

// Sabot (cheval/vache)
function Hoof({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <ellipse cx="0" cy="1" rx="4.5" ry="5.5" fill={color} />
      <line x1="0" y1="-4" x2="0" y2="5" stroke="#f0f7f2" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  )
}

// Griffe d'oiseau (3 doigts)
function BirdClaw({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      {/* Patte centrale */}
      <line x1="0" y1="0" x2="0" y2="-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Patte gauche */}
      <line x1="0" y1="0" x2="-5" y2="-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Patte droite */}
      <line x1="0" y1="0" x2="5" y2="-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Patte arrière */}
      <line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      {/* Articulation */}
      <circle cx="0" cy="0" r="1.5" fill={color} />
    </g>
  )
}

// Nageoire de poisson
function FishFin({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      {/* Queue en V */}
      <path d="M 0 0 Q -6 -4 -7 -8 Q -3 -5 0 -6 Q 3 -5 7 -8 Q 6 -4 0 0 Z" fill={color} />
      {/* Corps */}
      <ellipse cx="0" cy="4" rx="3" ry="5" fill={color} />
      {/* Nageoire dorsale */}
      <path d="M -1 1 Q -4 -3 0 -2 Q 4 -3 1 1 Z" fill={color} opacity="0.7" />
    </g>
  )
}

// Queue de serpent (spirale)
function SnakeTail({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <path
        d="M 0 6 C -5 4 -6 -1 -2 -3 C 2 -5 5 -2 3 2 C 1 5 -2 5 -3 3"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"
      />
      {/* Langue */}
      <line x1="0" y1="6" x2="-1" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="0" y1="6" x2="1" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

// Patte de lapin (longue + coussinets)
function RabbitPaw({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      {/* Patte longue */}
      <ellipse cx="0" cy="2" rx="3" ry="6" fill={color} />
      {/* 3 petits coussinets */}
      <circle cx="-2" cy="-4" r="1.5" fill={color} />
      <circle cx="2" cy="-4" r="1.5" fill={color} />
      <circle cx="0" cy="-6.5" r="1.5" fill={color} />
    </g>
  )
}

// Pince de crabe
function CrabClaw({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      {/* Pince supérieure */}
      <path d="M 0 0 Q 2 -4 6 -3 Q 8 -2 6 0 Q 4 1 0 0 Z" fill={color} />
      {/* Pince inférieure */}
      <path d="M 0 0 Q 2 3 6 2 Q 8 1 6 -1 Q 4 -2 0 0 Z" fill={color} />
      {/* Bras */}
      <line x1="0" y1="0" x2="-5" y2="0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

// Queue touffue (renard, écureuil)
function BushyTail({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <path d="M 0 5 C -5 3 -7 -2 -4 -6 C -2 -9 2 -9 4 -6 C 7 -2 5 3 0 5 Z" fill={color} />
      <path d="M 0 5 C -3 2 -4 -1 -2 -4 C -1 -6 1 -6 2 -4 C 4 -1 3 2 0 5 Z" fill="#a8d4b5" />
    </g>
  )
}

const MARKERS = [
  { Component: DogPaw,    label: 'Chien' },
  { Component: CatPaw,    label: 'Chat' },
  { Component: BirdClaw,  label: 'Oiseau' },
  { Component: FishFin,   label: 'Poisson' },
  { Component: SnakeTail, label: 'Reptile' },
  { Component: Hoof,      label: 'Cheval' },
  { Component: RabbitPaw, label: 'Lapin' },
  { Component: CrabClaw,  label: 'Crabe' },
  { Component: BushyTail, label: 'Renard' },
  { Component: DogPaw,    label: 'Chien 2' },
  { Component: CatPaw,    label: 'Chat 2' },
  { Component: BirdClaw,  label: 'Oiseau 2' },
]

const COLORS = [
  '#3d6b4f', '#6b9e7a', '#4a8a63', '#8bbf96',
  '#2d5a40', '#5a8f6a', '#7ab08a', '#3d6b4f',
  '#6b9e7a', '#4a8a63', '#3d6b4f', '#8bbf96',
]

// Logo complet : cercle derrière le texte, contour + empreintes clippés hors zone texte
// Pas de rectangle blanc — le fond vert clair du cercle reste visible derrière les lettres
function Logo1Full({ size = 280, markers = 8 }: { size?: number; markers?: number }) {
  const h = size * (100 / 280)
  const cx = 32, cy = 50, r = 42
  const textTop = 12
  const textBottom = 74
  const count = Math.min(markers, MARKERS.length)
  const uid = `lf${size}`

  return (
    <svg width={size} height={h} viewBox="0 0 280 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Zone visible : au-dessus ET en-dessous du texte */}
        <clipPath id={`${uid}-out`}>
          <rect x="0" y="0"           width="280" height={textTop} />
          <rect x="0" y={textBottom}  width="280" height={100 - textBottom} />
        </clipPath>
      </defs>

      {/* 1. Fond du cercle — plein, derrière tout */}
      <circle cx={cx} cy={cy} r={r} fill="#eef6f0" />

      {/* 2. Empreintes — seulement au-dessus et en-dessous du texte */}
      <g clipPath={`url(#${uid}-out)`}>
        {Array.from({ length: count }).map((_, i) => {
          const angle = (i * 360) / count
          const rad = (angle * Math.PI) / 180
          const px = cx + r * Math.sin(rad)
          const py = cy - r * Math.cos(rad)
          const { Component } = MARKERS[i]
          return <Component key={i} x={px} y={py} angle={angle} color={COLORS[i % COLORS.length]} />
        })}
      </g>

      {/* 3. Contour du cercle — seulement au-dessus et en-dessous du texte */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#7ab890" strokeWidth="2"
        clipPath={`url(#${uid}-out)`} />

      {/* 4. Texte "Animéaux" par-dessus, même police, même graisse */}
      <text
        x="4" y="66"
        fontSize="52"
        fontWeight="900"
        fill="#3d6b4f"
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="-1.5"
      >Animéaux</text>
    </svg>
  )
}

// Alias pour l'icône seule (sans texte)
function Logo1({ size = 100, markers = 8 }: { size?: number; markers?: number }) {
  const cx = 50, cy = 50, r = 42
  const count = Math.min(markers, MARKERS.length)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r="49" fill="#eef6f0" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#d0e8d5" strokeWidth="0.8" strokeDasharray="2 3" />
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i * 360) / count
        const rad = (angle * Math.PI) / 180
        const px = cx + r * Math.sin(rad)
        const py = cy - r * Math.cos(rad)
        const { Component } = MARKERS[i]
        return <Component key={i} x={px} y={py} angle={angle} color={COLORS[i % COLORS.length]} />
      })}
      <text x="50" y="62" textAnchor="middle" fontSize="28" fontWeight="900"
        fill="#3d6b4f" fontFamily="Inter, system-ui, sans-serif" letterSpacing="-1">Ani</text>
    </svg>
  )
}

export default function LogoPreview() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-16 py-20 px-8">
      <h1 className="text-2xl font-bold text-gray-700">Animéaux — Logo</h1>

      {/* Logo complet en différentes tailles */}
      <div className="flex flex-col items-center gap-6">
        <span className="text-sm text-gray-500 font-medium">Logo complet — cercle derrière "Ani"</span>
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <Logo1Full size={520} markers={12} />
            <span className="text-xs text-gray-400">Grande taille (12 empreintes)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Logo1Full size={320} markers={8} />
            <span className="text-xs text-gray-400">Taille normale (8 empreintes)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Logo1Full size={180} markers={8} />
            <span className="text-xs text-gray-400">Petite</span>
          </div>
        </div>
      </div>

      {/* Version navbar */}
      <div className="flex flex-col items-center gap-4">
        <span className="text-sm text-gray-500 font-medium">Version navbar</span>
        <div className="flex gap-6 flex-wrap justify-center">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm">
            <Logo1Full size={220} markers={8} />
          </div>
          <div className="px-6 py-4 rounded-2xl shadow-sm" style={{ background: '#3d6b4f' }}>
            <Logo1Full size={220} markers={8} />
          </div>
        </div>
      </div>

      {/* Icône seule */}
      <div className="flex flex-col items-center gap-4">
        <span className="text-sm text-gray-500 font-medium">Icône seule (favicon)</span>
        <div className="flex items-end gap-6">
          <Logo1 size={100} markers={8} />
          <Logo1 size={60} markers={8} />
          <Logo1 size={36} markers={8} />
        </div>
      </div>

      {/* Légende des marqueurs */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm text-gray-500 font-medium">Les 8 empreintes</span>
        <div className="flex gap-6 flex-wrap justify-center bg-white p-6 rounded-2xl shadow-sm">
          {MARKERS.slice(0, 8).map(({ Component, label }, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <svg width="40" height="40" viewBox="0 0 100 100">
                <Component x={50} y={50} angle={0} color={COLORS[i]} />
              </svg>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
