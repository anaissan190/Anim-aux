-- ============================================================
-- ANIMÉAUX — Ajoute deux nouveaux filtres de recherche :
-- "Espèces acceptées" (accepted_species) et "Se déplace à domicile"
-- (home_visit). Catégories volontairement larges (Chiens, Chats, NAC,
-- Équidés, Oiseaux) plutôt que la liste granulaire de animalSpecies.ts,
-- car il s'agit du périmètre de pratique du praticien, pas d'une fiche
-- animal précise.
-- ============================================================

alter table public.doctors
  add column if not exists accepted_species text[] not null default '{}',
  add column if not exists home_visit boolean not null default false;

create index if not exists idx_doctors_accepted_species on public.doctors using gin (accepted_species);

notify pgrst, 'reload schema';
