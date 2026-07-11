-- ============================================================
-- ANIMÉAUX — Index de performance pour l'agenda/dossiers partagés
-- du cabinet.
-- Les migrations 026 à 030 ont ajouté de nombreuses policies RLS
-- qui jointent systématiquement clinic_members (deux fois) sur
-- quasiment toutes les tables de dossier patient (profiles,
-- animals, vaccines, weight_tracking, health_records,
-- animal_documents, appointment_documents, appointment_animals).
-- La table clinic_members ayant été créée hors des migrations
-- committées de ce dépôt, on ne peut pas garantir qu'elle est
-- indexée sur doctor_id/clinic_id — sans index, Postgres doit
-- scanner toute la table à chaque évaluation de policy, sur
-- quasiment chaque page de l'appli praticien. C'est très
-- probablement la cause principale de la lenteur ressentie.
-- Ajout d'index (opération sûre, aucune donnée modifiée).
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

create index if not exists idx_clinic_members_doctor on public.clinic_members(doctor_id);
create index if not exists idx_clinic_members_clinic on public.clinic_members(clinic_id);

create index if not exists idx_animals_owner on public.animals(owner_id);
create index if not exists idx_vaccines_animal on public.vaccines(animal_id);
create index if not exists idx_weight_tracking_animal on public.weight_tracking(animal_id);
create index if not exists idx_health_records_animal on public.health_records(animal_id);

-- Rafraîchit les statistiques du planificateur pour ces tables afin
-- qu'il tienne compte des nouveaux index immédiatement.
analyze public.clinic_members;
analyze public.animals;
analyze public.appointments;
