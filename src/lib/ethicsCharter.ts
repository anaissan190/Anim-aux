// src/lib/ethicsCharter.ts
// Contenu de l'engagement bien-être animal, affiché à l'inscription
// praticien (RegisterPage.tsx, case à cocher obligatoire), sur la page
// légale dédiée (/engagement, LegalPage.tsx) et rappelé aux praticiens déjà
// inscrits avant cette fonctionnalité (DoctorDashboard.tsx). Centralisé ici
// pour n'avoir qu'un seul texte à faire relire par un professionnel du
// droit avant mise en ligne (voir le bandeau d'avertissement sur /cgu,
// même principe appliqué ici).
export const ETHICS_CHARTER_CLAUSES: string[] = [
  "N'utiliser que des méthodes respectueuses du bien-être de l'animal, sans violence, intimidation ni contrainte physique ou psychologique injustifiée.",
  "Respecter les besoins physiologiques et comportementaux propres à l'espèce et à l'individu que je prends en charge.",
  "Ne jamais pratiquer un acte relevant de l'exercice de la médecine ou de la chirurgie vétérinaire si je n'y suis pas légalement habilité (art. L241-1 du Code rural et de la pêche maritime).",
  "Orienter le propriétaire vers un vétérinaire si je constate un signe de souffrance, de maladie ou de danger nécessitant une prise en charge médicale.",
  "Communiquer de façon transparente sur mes méthodes, mes tarifs et les limites de mon intervention.",
  "Signaler aux autorités compétentes toute situation de maltraitance animale dont j'aurais connaissance (art. L214-3 du Code rural — obligation déjà prévue par la loi, rappelée ici).",
]

export const ETHICS_CHARTER_DISCLAIMER =
  "Cet engagement est une déclaration sur l'honneur du praticien. Animéaux vérifie l'identité et, selon les métiers, les diplômes déclarés, mais ne contrôle pas les méthodes de travail employées au quotidien. Tout signalement d'un manquement à cet engagement peut être adressé à contact.animeaux@gmail.com et fera l'objet d'une vérification."
