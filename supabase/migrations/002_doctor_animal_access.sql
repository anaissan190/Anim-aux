-- ============================================================
-- ANIMÉAUX — Accès praticien au dossier animal
-- Permet au praticien de consulter et enrichir (vaccins, poids,
-- dossier de santé) le dossier des animaux de ses patients lors
-- d'une consultation, et lie un RDV à l'animal concerné.
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- ============================================================
-- Lien optionnel entre un RDV et l'animal concerné
-- ============================================================
alter table public.appointments
  add column if not exists animal_id uuid references public.animals(id) on delete set null;

create index if not exists idx_appointments_animal on public.appointments(animal_id);

-- ============================================================
-- RLS — PROFILES : le praticien voit le profil de ses patients
-- ============================================================
drop policy if exists "profiles: médecin voit ses patients" on public.profiles;
create policy "profiles: médecin voit ses patients" on public.profiles for select using (
  exists (
    select 1 from public.appointments a
    where a.patient_id = profiles.user_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ============================================================
-- RLS — ANIMALS : le praticien voit les animaux de ses patients
-- (RDV confirmé ou terminé)
-- ============================================================
alter table public.animals enable row level security;

drop policy if exists "animals: médecin voit les animaux de ses patients" on public.animals;
create policy "animals: médecin voit les animaux de ses patients" on public.animals for select using (
  exists (
    select 1 from public.appointments a
    where a.patient_id = animals.owner_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- RLS — VACCINES : lecture + ajout par le praticien
-- ============================================================
alter table public.vaccines enable row level security;

drop policy if exists "vaccines: médecin voit celles des animaux de ses patients" on public.vaccines;
create policy "vaccines: médecin voit celles des animaux de ses patients" on public.vaccines for select using (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = vaccines.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

drop policy if exists "vaccines: médecin peut ajouter" on public.vaccines;
create policy "vaccines: médecin peut ajouter" on public.vaccines for insert with check (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = vaccines.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- RLS — WEIGHT_TRACKING : lecture + ajout par le praticien
-- ============================================================
alter table public.weight_tracking enable row level security;

drop policy if exists "weight_tracking: médecin voit celles des animaux de ses patients" on public.weight_tracking;
create policy "weight_tracking: médecin voit celles des animaux de ses patients" on public.weight_tracking for select using (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = weight_tracking.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

drop policy if exists "weight_tracking: médecin peut ajouter" on public.weight_tracking;
create policy "weight_tracking: médecin peut ajouter" on public.weight_tracking for insert with check (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = weight_tracking.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- ============================================================
-- RLS — HEALTH_RECORDS : lecture + ajout par le praticien
-- ============================================================
alter table public.health_records enable row level security;

drop policy if exists "health_records: médecin voit ceux des animaux de ses patients" on public.health_records;
create policy "health_records: médecin voit ceux des animaux de ses patients" on public.health_records for select using (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = health_records.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

drop policy if exists "health_records: médecin peut ajouter" on public.health_records;
create policy "health_records: médecin peut ajouter" on public.health_records for insert with check (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = health_records.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);
