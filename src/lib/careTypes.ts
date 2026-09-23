// src/lib/careTypes.ts
// Types de suivi récurrent (care_items.care_type, voir migration 100 du
// 23/09/2026 — généralisation de "vaccines" au-delà des seuls vaccins).
// Centralisé ici pour que RemindersPage et AnimalHealthPage affichent les
// mêmes libellés/icônes, plutôt que de les dupliquer à deux endroits.
import type { CareType } from '@/hooks/useData'

export const CARE_TYPES: { id: CareType; label: string; icon: string }[] = [
  { id: 'vaccine', label: 'Vaccin', icon: '💉' },
  { id: 'deworming', label: 'Vermifuge', icon: '💊' },
  { id: 'checkup', label: 'Bilan annuel', icon: '🩺' },
  { id: 'other', label: 'Autre suivi', icon: '📋' },
]

const CARE_TYPES_BY_ID = new Map(CARE_TYPES.map(t => [t.id, t]))

export function careTypeLabel(careType: string | null | undefined): string {
  return CARE_TYPES_BY_ID.get(careType as CareType)?.label ?? CARE_TYPES_BY_ID.get('other')!.label
}

export function careTypeIcon(careType: string | null | undefined): string {
  return CARE_TYPES_BY_ID.get(careType as CareType)?.icon ?? CARE_TYPES_BY_ID.get('other')!.icon
}
