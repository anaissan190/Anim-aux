-- ============================================================
-- ANIMÉAUX — Accès complet aux patients du cabinet pour tous les
-- praticiens membres, sans condition de statut de RDV.
-- La migration 026 limitait le partage de dossier aux patients
-- ayant un RDV "confirmed" ou "completed" avec un collègue —
-- ce qui bloquait l'accès dès qu'un RDV était encore "pending"
-- (ou tout autre statut). Décision produit : n'importe quel
-- praticien du cabinet doit pouvoir consulter (et compléter) le
-- dossier de n'importe quel patient du cabinet, dès lors qu'un
-- RDV — quel qu'en soit le statut — le relie à un des praticiens
-- du cabinet.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- PROFILES
drop policy if exists "profiles: médecin voit les patients de son cabinet" on public.profiles;
create policy "profiles: médecin voit les patients de son cabinet" on public.profiles for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.patient_id = profiles.user_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ANIMALS
drop policy if exists "animals: médecin voit les animaux des patients de son cabinet" on public.animals;
create policy "animals: médecin voit les animaux des patients de son cabinet" on public.animals for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.patient_id = animals.owner_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- VACCINES
drop policy if exists "vaccines: médecin voit ceux des patients de son cabinet" on public.vaccines;
create policy "vaccines: médecin voit ceux des patients de son cabinet" on public.vaccines for select using (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = vaccines.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

drop policy if exists "vaccines: médecin peut ajouter pour son cabinet" on public.vaccines;
create policy "vaccines: médecin peut ajouter pour son cabinet" on public.vaccines for insert with check (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = vaccines.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- WEIGHT_TRACKING
drop policy if exists "weight_tracking: médecin voit ceux des patients de son cabinet" on public.weight_tracking;
create policy "weight_tracking: médecin voit ceux des patients de son cabinet" on public.weight_tracking for select using (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = weight_tracking.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

drop policy if exists "weight_tracking: médecin peut ajouter pour son cabinet" on public.weight_tracking;
create policy "weight_tracking: médecin peut ajouter pour son cabinet" on public.weight_tracking for insert with check (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = weight_tracking.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- HEALTH_RECORDS
drop policy if exists "health_records: médecin voit ceux des patients de son cabinet" on public.health_records;
create policy "health_records: médecin voit ceux des patients de son cabinet" on public.health_records for select using (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = health_records.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

drop policy if exists "health_records: médecin peut ajouter pour son cabinet" on public.health_records;
create policy "health_records: médecin peut ajouter pour son cabinet" on public.health_records for insert with check (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = health_records.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ANIMAL_DOCUMENTS
drop policy if exists "animal_documents: médecin voit ceux des patients de son cabinet" on public.animal_documents;
create policy "animal_documents: médecin voit ceux des patients de son cabinet" on public.animal_documents for select using (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = animal_documents.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

drop policy if exists "animal_documents: médecin peut ajouter pour son cabinet" on public.animal_documents;
create policy "animal_documents: médecin peut ajouter pour son cabinet" on public.animal_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = animal_documents.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);
