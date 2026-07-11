-- ============================================================
-- ANIMÉAUX — Partage des dossiers patients entre praticiens d'un
-- même cabinet (pour pouvoir couvrir un collègue absent/en congé).
-- Ajoute, en complément des policies existantes (accès à SES
-- propres patients), un accès aux patients vus par n'importe quel
-- collègue du même cabinet.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- ============================================================
-- PROFILES : voir le profil des patients des collègues de cabinet
-- ============================================================
drop policy if exists "profiles: médecin voit les patients de son cabinet" on public.profiles;
create policy "profiles: médecin voit les patients de son cabinet" on public.profiles for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.patient_id = profiles.user_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- ANIMALS : voir les animaux des patients des collègues de cabinet
-- ============================================================
drop policy if exists "animals: médecin voit les animaux des patients de son cabinet" on public.animals;
create policy "animals: médecin voit les animaux des patients de son cabinet" on public.animals for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.patient_id = animals.owner_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- VACCINES : lecture + ajout pour les patients des collègues de cabinet
-- ============================================================
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
      and a.status in ('confirmed', 'completed')
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
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- WEIGHT_TRACKING : lecture + ajout pour les patients des collègues
-- ============================================================
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
      and a.status in ('confirmed', 'completed')
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
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- HEALTH_RECORDS : lecture + ajout pour les patients des collègues
-- ============================================================
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
      and a.status in ('confirmed', 'completed')
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
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- ANIMAL_DOCUMENTS : lecture + ajout pour les patients des collègues
-- ============================================================
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
      and a.status in ('confirmed', 'completed')
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
      and a.status in ('confirmed', 'completed')
  )
);
