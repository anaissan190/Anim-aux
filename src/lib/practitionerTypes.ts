// src/lib/practitionerTypes.ts

export interface PractitionerType {
  id: string
  label: string
  icon: string
  services: { name: string; duration: string }[]
}

export const PRACTITIONER_TYPES: PractitionerType[] = [
  {
    id: 'veterinaire',
    label: 'Vétérinaire',
    icon: '🩺',
    services: [
      { name: 'Consultation',          duration: '30 min' },
      { name: 'Vaccination',           duration: '15 min' },
      { name: 'Chirurgie',             duration: 'Variable' },
      { name: 'Radiographie / Imagerie', duration: '20 min' },
      { name: 'Analyse de laboratoire', duration: '15 min' },
      { name: 'Hospitalisation',       duration: 'Par nuit' },
      { name: 'Stérilisation',         duration: 'Variable' },
    ],
  },
  {
    id: 'toiletteur',
    label: 'Toiletteur',
    icon: '✂️',
    services: [
      { name: 'Toilettage complet',    duration: '1h30' },
      { name: 'Bain & séchage',        duration: '45 min' },
      { name: 'Coupe des griffes',     duration: '15 min' },
      { name: 'Coupe des poils',       duration: '45 min' },
      { name: 'Épilation des oreilles', duration: '15 min' },
      { name: 'Brossage',              duration: '20 min' },
    ],
  },
  {
    id: 'comportementaliste',
    label: 'Comportementaliste',
    icon: '🧠',
    services: [
      { name: 'Bilan comportemental',  duration: '1h' },
      { name: 'Séance individuelle',   duration: '1h' },
      { name: 'Séance en groupe',      duration: '1h30' },
      { name: 'Suivi à domicile',      duration: '1h30' },
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
]

export function getPractitionerType(id: string): PractitionerType | undefined {
  return PRACTITIONER_TYPES.find(p => p.id === id)
}
