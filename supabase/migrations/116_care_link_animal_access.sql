-- 116_care_link_animal_access.sql
-- Règle d'accès d'un praticien au dossier d'un animal (décision d'Anaïs,
-- 05/10/2026) : le praticien (ou un confrère de son cabinet) voit l'animal tant
-- qu'il existe un rendez-vous MAINTENU (confirmé ou terminé) datant de moins
-- d'un an — futur compris. Conséquences :
--   * 1er rendez-vous annulé  -> aucun rendez-vous maintenu -> aucun accès ;
--   * animal déjà vu          -> l'annulation d'un RDV ultérieur ne retire rien
--                                (la visite précédente couvre encore) ;
--   * plus de RDV depuis 1 an -> accès perdu, retrouvé dès un nouveau RDV ;
--   * "absent" (no_show) et annulé ne comptent jamais.
-- Avant : accès illimité dans le temps pour un praticien seul, et pour les
-- confrères d'un cabinet quel que soit le statut du RDV (même annulé).
--
-- Ne touche PAS : les policies "propriétaire", les accès par partage de dossier
-- (migrations 105/106, noms contenant "référé"), les policies sur profiles
-- (nom/coordonnées du propriétaire, nécessaires à l'agenda même après
-- annulation) ni appointment_animals / appointment_documents. Les données
-- ajoutées par le praticien restent en base et redeviennent visibles avec un
-- nouveau rendez-vous.

-- Fonctions security definer : elles lisent appointments/doctors/clinic_members
-- sans repasser par leurs policies, ce qui évite toute récursion RLS (même
-- principe que has_appointment_with_doctor, migration 097).
create or replace function public.doctor_has_care_link(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where a.patient_id = p_owner_id
      and a.status in ('confirmed', 'completed')
      and a.start_at > now() - interval '1 year'
      and a.doctor_id in (
        select d.id from public.doctors d where d.user_id = auth.uid()
        union
        select cm_collegue.doctor_id
        from public.clinic_members cm_collegue
        join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
        join public.doctors me on me.id = cm_moi.doctor_id
        where me.user_id = auth.uid()
      )
  )
$$;

create or replace function public.doctor_has_care_link_for_animal(p_animal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.doctor_has_care_link((select owner_id from public.animals where id = p_animal_id))
$$;

grant execute on function public.doctor_has_care_link(uuid) to authenticated;
grant execute on function public.doctor_has_care_link_for_animal(uuid) to authenticated;

-- Supprime TOUTES les policies praticien de ces tables (noms connus ou non :
-- la base de production a déjà divergé des fichiers de migration par le
-- passé), sauf celles de partage de dossier ("référé").
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('animals', 'care_items', 'weight_tracking', 'health_records', 'animal_documents')
      and policyname ilike '%médecin%'
      and policyname not ilike '%référé%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ANIMALS : lecture seule
create policy "animals: médecin voit les animaux de ses patients" on public.animals
  for select using (public.doctor_has_care_link(owner_id));

-- CARE_ITEMS, WEIGHT_TRACKING, HEALTH_RECORDS : lecture, ajout, modification, suppression
create policy "care_items: médecin voit (lien de soin)" on public.care_items
  for select using (public.doctor_has_care_link_for_animal(animal_id));
create policy "care_items: médecin ajoute (lien de soin)" on public.care_items
  for insert with check (public.doctor_has_care_link_for_animal(animal_id));
create policy "care_items: médecin modifie (lien de soin)" on public.care_items
  for update using (public.doctor_has_care_link_for_animal(animal_id));
create policy "care_items: médecin supprime (lien de soin)" on public.care_items
  for delete using (public.doctor_has_care_link_for_animal(animal_id));

create policy "weight_tracking: médecin voit (lien de soin)" on public.weight_tracking
  for select using (public.doctor_has_care_link_for_animal(animal_id));
create policy "weight_tracking: médecin ajoute (lien de soin)" on public.weight_tracking
  for insert with check (public.doctor_has_care_link_for_animal(animal_id));
create policy "weight_tracking: médecin modifie (lien de soin)" on public.weight_tracking
  for update using (public.doctor_has_care_link_for_animal(animal_id));
create policy "weight_tracking: médecin supprime (lien de soin)" on public.weight_tracking
  for delete using (public.doctor_has_care_link_for_animal(animal_id));

create policy "health_records: médecin voit (lien de soin)" on public.health_records
  for select using (public.doctor_has_care_link_for_animal(animal_id));
create policy "health_records: médecin ajoute (lien de soin)" on public.health_records
  for insert with check (public.doctor_has_care_link_for_animal(animal_id));
create policy "health_records: médecin modifie (lien de soin)" on public.health_records
  for update using (public.doctor_has_care_link_for_animal(animal_id));
create policy "health_records: médecin supprime (lien de soin)" on public.health_records
  for delete using (public.doctor_has_care_link_for_animal(animal_id));

-- ANIMAL_DOCUMENTS : lecture + ajout (uploaded_by = soi-même, comme avant)
create policy "animal_documents: médecin voit (lien de soin)" on public.animal_documents
  for select using (public.doctor_has_care_link_for_animal(animal_id));
create policy "animal_documents: médecin ajoute (lien de soin)" on public.animal_documents
  for insert with check (uploaded_by = auth.uid() and public.doctor_has_care_link_for_animal(animal_id));
