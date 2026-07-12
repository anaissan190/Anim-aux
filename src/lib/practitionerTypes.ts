// src/lib/practitionerTypes.ts
//
// Liste fermée des métiers animaliers proposés dans l'appli (inscription
// praticien + édition du profil). Volontairement exhaustive pour éviter
// qu'un praticien saisisse un texte libre : soit son métier y figure, soit
// il choisit "Autre". Catégorie "vente et conseil" (ex: vendeur en
// animalerie) volontairement exclue — hors périmètre d'une appli de prise
// de rendez-vous.

export interface PractitionerType {
  id: string
  label: string
  icon: string
  services: { name: string; duration: string }[]
}

export const PRACTITIONER_TYPES: PractitionerType[] = [
  // ─── Soins vétérinaires et médicaux ───────────────────────────
  {
    id: 'veterinaire',
    label: 'Vétérinaire',
    icon: '🩺',
    services: [
      { name: 'Consultation',            duration: '30 min' },
      { name: 'Vaccination',             duration: '15 min' },
      { name: 'Chirurgie',               duration: 'Variable' },
      { name: 'Radiographie / Imagerie', duration: '20 min' },
      { name: 'Analyse de laboratoire',  duration: '15 min' },
      { name: 'Hospitalisation',         duration: 'Par nuit' },
      { name: 'Stérilisation',           duration: 'Variable' },
    ],
  },
  {
    id: 'asv',
    label: 'Auxiliaire spécialisé vétérinaire (ASV)',
    icon: '💉',
    services: [
      { name: 'Prise de sang',   duration: '15 min' },
      { name: 'Pansement / soin', duration: '20 min' },
      { name: 'Pesée / suivi de poids', duration: '10 min' },
    ],
  },
  {
    id: 'osteopathe',
    label: 'Ostéopathe animalier',
    icon: '🤲',
    services: [
      { name: 'Bilan ostéopathique',   duration: '1h' },
      { name: 'Séance de soin',        duration: '45 min' },
      { name: 'Suivi post-opératoire', duration: '45 min' },
    ],
  },
  {
    id: 'kinesitherapeute',
    label: 'Kinésithérapeute animalier',
    icon: '🦴',
    services: [
      { name: 'Bilan kinésithérapique', duration: '45 min' },
      { name: 'Séance de rééducation',  duration: '45 min' },
    ],
  },
  {
    id: 'hydrotherapeute',
    label: 'Hydrothérapeute animalier',
    icon: '💧',
    services: [
      { name: 'Séance de balnéothérapie', duration: '30 min' },
      { name: 'Bilan initial',            duration: '45 min' },
    ],
  },
  {
    id: 'dentiste_equin',
    label: 'Dentiste équin',
    icon: '🦷',
    services: [
      { name: 'Bilan dentaire',  duration: '30 min' },
      { name: 'Détartrage',      duration: '45 min' },
    ],
  },
  {
    id: 'nutritionniste',
    label: 'Nutritionniste animalier',
    icon: '🥗',
    services: [
      { name: 'Bilan nutritionnel', duration: '45 min' },
      { name: 'Suivi de régime',    duration: '30 min' },
    ],
  },
  {
    id: 'naturopathe',
    label: 'Naturopathe animalier',
    icon: '🌿',
    services: [
      { name: 'Bilan naturopathique', duration: '1h' },
      { name: 'Séance de suivi',      duration: '45 min' },
    ],
  },

  // ─── Comportement et éducation ─────────────────────────────────
  {
    id: 'comportementaliste',
    label: 'Comportementaliste animalier',
    icon: '🧠',
    services: [
      { name: 'Bilan comportemental',  duration: '1h' },
      { name: 'Séance individuelle',   duration: '1h' },
      { name: 'Séance en groupe',      duration: '1h30' },
      { name: 'Suivi à domicile',      duration: '1h30' },
    ],
  },
  {
    id: 'ethologue',
    label: 'Éthologue',
    icon: '🔍',
    services: [
      { name: 'Observation comportementale', duration: '1h' },
      { name: 'Rapport et préconisations',   duration: '30 min' },
    ],
  },
  {
    id: 'educateur',
    label: 'Éducateur canin',
    icon: '🐕',
    services: [
      { name: 'Cours individuel',      duration: '1h' },
      { name: 'Cours en groupe',       duration: '1h30' },
      { name: 'Bilan éducatif',        duration: '1h' },
      { name: 'Suivi à domicile',      duration: '1h' },
    ],
  },
  {
    id: 'dresseur',
    label: 'Dresseur animalier',
    icon: '🎯',
    services: [
      { name: 'Séance de dressage', duration: '1h' },
      { name: 'Bilan initial',      duration: '45 min' },
    ],
  },
  {
    id: 'maitre_chien',
    label: 'Maître-chien',
    icon: '🐕‍🦺',
    services: [
      { name: 'Séance individuelle', duration: '1h' },
    ],
  },

  // ─── Bien-être et esthétique ────────────────────────────────────
  {
    id: 'toiletteur',
    label: 'Toiletteur',
    icon: '✂️',
    services: [
      { name: 'Toilettage complet',     duration: '1h30' },
      { name: 'Bain & séchage',         duration: '45 min' },
      { name: 'Coupe des griffes',      duration: '15 min' },
      { name: 'Coupe des poils',        duration: '45 min' },
      { name: 'Épilation des oreilles', duration: '15 min' },
      { name: 'Brossage',               duration: '20 min' },
    ],
  },
  {
    id: 'masseur_canin',
    label: 'Masseur canin',
    icon: '💆',
    services: [
      { name: 'Séance de massage', duration: '30 min' },
    ],
  },

  // ─── Élevage et garde ───────────────────────────────────────────
  {
    id: 'eleveur',
    label: 'Éleveur canin ou équin',
    icon: '🐴',
    services: [
      { name: 'Visite d\'élevage', duration: '30 min' },
    ],
  },
  {
    id: 'palefrenier',
    label: 'Palefrenier',
    icon: '🐎',
    services: [
      { name: 'Prestation de soin quotidien', duration: 'Variable' },
    ],
  },
  {
    id: 'soigneur',
    label: 'Soigneur animalier',
    icon: '🦁',
    services: [
      { name: 'Prestation de soin', duration: 'Variable' },
    ],
  },
  {
    id: 'pet_sitter',
    label: 'Pet-sitter',
    icon: '🏠',
    services: [
      { name: 'Garde à domicile',    duration: 'Variable' },
      { name: 'Promenade',           duration: '30 min' },
    ],
  },

  // ─── Autre ──────────────────────────────────────────────────────
  // Toujours en dernier : fourre-tout pour les métiers ne figurant pas
  // ci-dessus, plutôt que de laisser un champ de saisie libre.
  {
    id: 'autre',
    label: 'Autre',
    icon: '📋',
    services: [
      { name: 'Consultation', duration: '30 min' },
    ],
  },
]

export function getPractitionerType(id: string): PractitionerType | undefined {
  return PRACTITIONER_TYPES.find(p => p.id === id)
}
