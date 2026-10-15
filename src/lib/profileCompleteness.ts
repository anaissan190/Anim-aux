// src/lib/profileCompleteness.ts
// Jauge « Profil complété à X % » de l'en-tête du profil praticien : combien d'éléments d'une
// fiche soignée sont renseignés, et le premier qui manque (affiché en suggestion). Calcul pur,
// testé dans profileCompleteness.test.ts.
export interface ProfileCompletenessInput {
  avatarUrl?: string | null
  specialties?: string[] | null
  // La présentation est du HTML (éditeur de texte riche) : on compte le texte seul.
  bioHtml?: string | null
  phone?: string | null
  acceptedSpecies?: string[] | null
  // Ville ou adresse du praticien, ou celles de son cabinet
  hasAddress: boolean
  // Au moins un document de vérification déposé, ou profil déjà vérifié
  hasVerificationDocument: boolean
}

export interface ProfileCompleteness {
  percent: number
  done: number
  total: number
  // Premier élément manquant, en phrase prête à afficher ; null quand tout est renseigné
  hint: string | null
}

export const MIN_BIO_CHARS = 20

export function plainText(html: string | null | undefined): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function profileCompleteness(i: ProfileCompletenessInput): ProfileCompleteness {
  const steps: { ok: boolean; hint: string }[] = [
    { ok: !!i.avatarUrl, hint: 'Ajoutez une photo' },
    { ok: (i.specialties?.length ?? 0) > 0, hint: 'Choisissez votre métier' },
    { ok: plainText(i.bioHtml).length >= MIN_BIO_CHARS, hint: 'Rédigez une présentation' },
    { ok: !!i.phone?.trim(), hint: 'Ajoutez un numéro de téléphone' },
    { ok: (i.acceptedSpecies?.length ?? 0) > 0, hint: 'Indiquez les espèces acceptées' },
    { ok: i.hasAddress, hint: 'Indiquez votre adresse' },
    { ok: i.hasVerificationDocument, hint: 'Déposez un document de vérification' },
  ]
  const done = steps.filter(s => s.ok).length
  return {
    percent: Math.round((done / steps.length) * 100),
    done,
    total: steps.length,
    hint: steps.find(s => !s.ok)?.hint ?? null,
  }
}

// Profil d'un propriétaire d'animaux : photo, téléphone, adresse postale et contact d'urgence
// (nom ET téléphone). Mêmes règles d'affichage que le profil praticien.
export interface PatientCompletenessInput {
  avatarUrl?: string | null
  phone?: string | null
  homeAddress?: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
}

export function patientProfileCompleteness(i: PatientCompletenessInput): ProfileCompleteness {
  const steps: { ok: boolean; hint: string }[] = [
    { ok: !!i.avatarUrl, hint: 'Ajoutez une photo' },
    { ok: !!i.phone?.trim(), hint: 'Ajoutez un numéro de téléphone' },
    { ok: !!i.homeAddress?.trim(), hint: 'Indiquez votre adresse postale' },
    { ok: !!i.emergencyName?.trim() && !!i.emergencyPhone?.trim(), hint: 'Ajoutez un contact d\'urgence' },
  ]
  const done = steps.filter(s => s.ok).length
  return {
    percent: Math.round((done / steps.length) * 100),
    done,
    total: steps.length,
    hint: steps.find(s => !s.ok)?.hint ?? null,
  }
}
