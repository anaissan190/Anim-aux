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

// Même statut vu du praticien qui a ENVOYÉ le dossier : il ne "donne" pas
// son accord, il attend celui du propriétaire (d'où un libellé différent de
// celui ci-dessus, écrit du point de vue du propriétaire).
export function referralSenderStatusLabel(status: AnimalReferralStatus): string {
  switch (status) {
    case 'pending': return 'En attente de l\u2019accord du propriétaire'
    case 'accepted': return 'Accepté par le propriétaire'
    case 'declined': return 'Refusé par le propriétaire'
    case 'revoked': return 'Accès révoqué'
  }
}

// Classe de pastille (voir .badge-* dans index.css) : en attente = jaune,
// accepté = vert, refusé = rouge, révoqué = gris (fin de vie normale, pas une erreur).
export function referralBadgeClass(status: AnimalReferralStatus): string {
  switch (status) {
    case 'pending': return 'badge-yellow'
    case 'accepted': return 'badge-green'
    case 'declined': return 'badge-red'
    case 'revoked': return 'badge-gray'
  }
}
