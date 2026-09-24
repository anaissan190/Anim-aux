-- ============================================================
-- ANIMÉAUX — Accès en lecture seule pour le médecin destinataire d'un
-- partage accepté (23/09/2026)
-- ============================================================
-- Complète animal_referrals (migration 105) : dès qu'une demande de
-- partage passe à 'accepted', le médecin destinataire obtient un accès
-- LECTURE SEULE, limité à CET animal précis (pas aux autres animaux du
-- même propriétaire, pas de droit d'écriture) — le médecin référent, lui,
-- a déjà un accès complet via les policies cabinet/RDV existantes.
--
-- `profiles` est nécessaire en plus des tables médicales : AnimalHealthPage.
-- tsx appelle useAnimalOwner dès que isDoctor, pour afficher le nom du
-- propriétaire — sans cette policy, cet appel échouerait silencieusement
-- pour un médecin qui n'a accès à l'animal QUE via un partage (aucun lien
-- cabinet/RDV par ailleurs).
-- ============================================================

create policy "animals: médecin voit l'animal référé" on public.animals for select using (
  exists (
    select 1 from public.animal_referrals ar
    where ar.animal_id = animals.id
      and ar.status = 'accepted'
      and ar.target_doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

create policy "care_items: médecin voit ceux de l'animal référé" on public.care_items for select using (
  exists (
    select 1 from public.animal_referrals ar
    where ar.animal_id = care_items.animal_id
      and ar.status = 'accepted'
      and ar.target_doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

create policy "weight_tracking: médecin voit celui de l'animal référé" on public.weight_tracking for select using (
  exists (
    select 1 from public.animal_referrals ar
    where ar.animal_id = weight_tracking.animal_id
      and ar.status = 'accepted'
      and ar.target_doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

create policy "health_records: médecin voit celui de l'animal référé" on public.health_records for select using (
  exists (
    select 1 from public.animal_referrals ar
    where ar.animal_id = health_records.animal_id
      and ar.status = 'accepted'
      and ar.target_doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

create policy "animal_documents: médecin voit ceux de l'animal référé" on public.animal_documents for select using (
  exists (
    select 1 from public.animal_referrals ar
    where ar.animal_id = animal_documents.animal_id
      and ar.status = 'accepted'
      and ar.target_doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

create policy "profiles: médecin voit le propriétaire de l'animal référé" on public.profiles for select using (
  exists (
    select 1 from public.animal_referrals ar
    where ar.owner_id = profiles.user_id
      and ar.status = 'accepted'
      and ar.target_doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

notify pgrst, 'reload schema';
