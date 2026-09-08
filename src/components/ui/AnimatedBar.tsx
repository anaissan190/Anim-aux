// src/components/ui/AnimatedBar.tsx
// Jauge dont le remplissage s'anime à l'apparition (au lieu d'une largeur
// posée directement, sans transition visible) — retour d'Anaïs du
// 08/09/2026 sur l'aperçu de micro-interactions.
import { useEffect, useState } from 'react'

export default function AnimatedBar({ percent }: { percent: number }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setWidth(0)
    const t = setTimeout(() => setWidth(percent), 50)
    return () => clearTimeout(t)
  }, [percent])

  return (
    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-sage-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${width}%` }} />
    </div>
  )
}
