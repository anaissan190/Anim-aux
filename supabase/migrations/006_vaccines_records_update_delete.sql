-- ============================================================
-- ANIMÉAUX — Modification et suppression des vaccins et du
-- dossier de santé. Jusqu'ici, seules la lecture et l'ajout
-- étaient autorisées. Ajoute UPDATE/DELETE pour le propriétaire
-- de l'animal et pour le praticien suivant celui-ci (RDV confirmé
-- ou terminé). À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- ─────────────────────────── VACCINES ───────────────────────────
alter table public.vaccines enable row level security;

drop policy if exists "vaccines: propriétaire modifie" on public.vaccines;
create policy "vaccines: propriétaire modifie" on public.vaccines for update
  using (
    exists (select 1 from public.animals where id = vaccines.animal_id and owner_id = auth.uid())
  );

drop policy if exists "vaccines: propriétaire supprime" on public.vaccines;
create policy "vaccines: propriétaire supprime" on public.vaccines for delete
  using (
    exists (select 1 from public.animals where id = vaccines.animal_id and owner_id = auth.uid())
  );

drop policy if exists "vaccines: médecin modifie celles des animaux de ses patients" on public.vaccines;
create policy "vaccines: médecin modifie celles des animaux de ses patients" on public.vaccines for update
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = vaccines.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );

drop policy if exists "vaccines: médecin supprime celles des animaux de ses patients" on public.vaccines;
create policy "vaccines: médecin supprime celles des animaux de ses patients" on public.vaccines for delete
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = vaccines.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );

-- ────────────────────────── HEALTH_RECORDS ──────────────────────────
alter table public.health_records enable row level security;

drop policy if exists "health_records: propriétaire modifie" on public.health_records;
create policy "health_records: propriétaire modifie" on public.health_records for update
  using (
    exists (select 1 from public.animals where id = health_records.animal_id and owner_id = auth.uid())
  );

drop policy if exists "health_records: propriétaire supprime" on public.health_records;
create policy "health_records: propriétaire supprime" on public.health_records for delete
  using (
    exists (select 1 from public.animals where id = health_records.animal_id and owner_id = auth.uid())
  );

drop policy if exists "health_records: médecin modifie ceux des animaux de ses patients" on public.health_records;
create policy "health_records: médecin modifie ceux des animaux de ses patients" on public.health_records for update
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = health_records.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );

drop policy if exists "health_records: médecin supprime ceux des animaux de ses patients" on public.health_records;
create policy "health_records: médecin supprime ceux des animaux de ses patients" on public.health_records for delete
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = health_records.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );
