// src/components/ui/AnimatedCounter.tsx
// Chiffre qui défile de 0 jusqu'à sa valeur à l'apparition (ex: statistiques
// de la page d'accueil) — retour d'Anaïs du 08/09/2026 sur l'aperçu de
// micro-interactions.
import { useEffect, useState } from 'react'

interface Props {
  target: number
  decimals?: number
  suffix?: string
}

export default function AnimatedCounter({ target, decimals = 0, suffix = '' }: Props) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()
    const duration = 1200
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(target * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return <>{value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}
