-- ============================================================
-- ANIMÉAUX — Type de document (pour la fonctionnalité "Ordonnances")
-- Ajoute une colonne `document_type` à animal_documents pour pouvoir
-- distinguer les ordonnances des autres pièces jointes (analyses, radios...)
-- et les retrouver dans une vue dédiée côté patient, plutôt que de deviner
-- via le texte libre du champ `label`.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

alter table public.animal_documents
  add column if not exists document_type text not null default 'autre'
  check (document_type in ('ordonnance', 'analyse', 'radio', 'certificat', 'autre'));

create index if not exists idx_animal_documents_type on public.animal_documents(document_type);
