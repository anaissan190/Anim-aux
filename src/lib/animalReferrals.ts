// src/lib/animalReferrals.ts
// Libellé FR du statut d'un partage de dossier animal entre praticiens
// (voir migration 105) — extrait en fonction pure pour être réutilisé
// tel quel dans le bandeau propriétaire (AnimalHealthPage.tsx) et la
// liste "Dossiers reçus en référence" (DoctorDashboard.tsx), sans le
// dupliquer ni risquer de mal étiqueter un statut (ex: confondre
// "refusé" et "révoqué").
import type { AnimalReferralStatus } from '@/types'

export function referralStatusLabel(status: AnimalReferralStatus): string {
  switch (status) {
    case 'pending': return 'En attente de votre accord'
    case 'accepted': return 'Accepté'
    case 'declined': return 'Refusé'
    case 'revoked': return 'Accès révoqué'
  }
}
