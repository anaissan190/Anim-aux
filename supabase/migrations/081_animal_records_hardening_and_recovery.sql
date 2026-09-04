-- ============================================================
-- ANIMÉAUX — Deux correctifs issus de l'audit complet du 04/09/2026 :
--
-- 1) RECONSTRUCTION DE SECOURS : animals, vaccines, weight_tracking et
--    health_records ne figurent dans AUCUNE migration commitée (créées
--    directement dans Supabase, jamais committées) — exactement la
--    cause déjà responsable de la perte de 8 autres tables lors de
--    l'incident plateforme du 13-14/07/2026 (voir
--    039_recreate_incident_lost_tables.sql). Si un nouvel incident du
--    même type survient, ces 4 tables contenant des données médicales
--    seraient irrécupérables depuis le repo. Structure et policies
--    reconstruites ici à l'identique — colonnes/contraintes vérifiées
--    en direct le 04/09/2026 via information_schema, policies reprises
--    mot pour mot des migrations 002/005/006/030/039 qui les
--    définissent déjà (dernière version = celle qui s'applique, grâce
--    au drop policy if exists de chacune). CREATE TABLE IF NOT EXISTS
--    partout, donc sans effet sur les tables déjà en place aujourd'hui
--    — seules les policies sont réappliquées (recréation à l'identique,
--    pas de changement de comportement) avant le durcissement de la
--    partie 2.
--
-- 2) DURCISSEMENT RLS : comme pour appointments/doctors/messages/
--    notifications (migrations 079/080), plusieurs policies UPDATE
--    n'ont pas de WITH CHECK complet — RLS filtre les LIGNES, jamais
--    les colonnes :
--    - vaccines/health_records/weight_tracking : ni le propriétaire de
--      l'animal ni le médecin qui le suit n'ont de verrou sur
--      animal_id. Un médecin suivant deux patients différents peut
--      déplacer le dossier vaccin/santé/poids d'un patient A vers un
--      animal du patient B, corrompant ou exposant un dossier médical
--      dans le mauvais carnet de santé.
--    - reviews : le WITH CHECK existant (011) ne verrouille que
--      patient_id, pas doctor_id/appointment_id. Un patient peut
--      réassigner un avis existant à un autre praticien, sabotant sa
--      note pendant que celle du praticien initial reste faussement
--      inchangée (trg_update_rating ne recalcule que le nouveau
--      doctor_id).
-- ============================================================

-- ============================================================
-- 1) RECONSTRUCTION DE SECOURS
-- ============================================================

create table if not exists public.animals (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  species text not null,
  breed text,
  gender text,
  date_of_birth date,
  weight_kg numeric,
  microchip_number text,
  tattoo_number text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.vaccines (
  id uuid default uuid_generate_v4() primary key,
  animal_id uuid references public.animals(id) on delete cascade not null,
  name text not null,
  date_administered date not null,
  next_due_date date,
  administered_by text,
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.weight_tracking (
  id uuid default uuid_generate_v4() primary key,
  animal_id uuid references public.animals(id) on delete cascade not null,
  weight_kg numeric not null,
  measured_at date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.health_records (
  id uuid default uuid_generate_v4() primary key,
  animal_id uuid references public.animals(id) on delete cascade not null,
  date date not null,
  type text not null,
  title text not null,
  description text,
  professional_name text,
  created_at timestamptz default now()
);

alter table public.animals enable row level security;
alter table public.vaccines enable row level security;
alter table public.weight_tracking enable row level security;
alter table public.health_records enable row level security;

-- ── ANIMALS (002, 030) ───────────────────────────────────────────────
drop policy if exists "animals: owner peut tout" on public.animals;
create policy "animals: owner peut tout" on public.animals for all
  using (auth.uid() = owner_id);

drop policy if exists "animals: médecin voit les animaux de ses patients" on public.animals;
create policy "animals: médecin voit les animaux de ses patients" on public.animals for select using (
  exists (
    select 1 from public.appointments a
    where a.patient_id = animals.owner_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

drop policy if exists "animals: vétérinaire peut voir" on public.animals;
create policy "animals: vétérinaire peut voir" on public.animals for select using (
  exists (select 1 from public.users where users.id = auth.uid() and users.role = 'doctor')
);

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

-- ── VACCINES (002, 006, 030) ─────────────────────────────────────────
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
drop policy if exists "vaccines: propriétaire modifie" on public.vaccines;
create policy "vaccines: propriétaire modifie" on public.vaccines for update
  using (exists (select 1 from public.animals where id = vaccines.animal_id and owner_id = auth.uid()));
drop policy if exists "vaccines: propriétaire supprime" on public.vaccines;
create policy "vaccines: propriétaire supprime" on public.vaccines for delete
  using (exists (select 1 from public.animals where id = vaccines.animal_id and owner_id = auth.uid()));
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

-- ── WEIGHT_TRACKING (002, 005, 030) ──────────────────────────────────
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
drop policy if exists "weight_tracking: propriétaire modifie" on public.weight_tracking;
create policy "weight_tracking: propriétaire modifie" on public.weight_tracking for update
  using (exists (select 1 from public.animals where id = weight_tracking.animal_id and owner_id = auth.uid()));
drop policy if exists "weight_tracking: propriétaire supprime" on public.weight_tracking;
create policy "weight_tracking: propriétaire supprime" on public.weight_tracking for delete
  using (exists (select 1 from public.animals where id = weight_tracking.animal_id and owner_id = auth.uid()));
drop policy if exists "weight_tracking: médecin modifie celles des animaux de ses patients" on public.weight_tracking;
create policy "weight_tracking: médecin modifie celles des animaux de ses patients" on public.weight_tracking for update
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = weight_tracking.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );
drop policy if exists "weight_tracking: médecin supprime celles des animaux de ses patients" on public.weight_tracking;
create policy "weight_tracking: médecin supprime celles des animaux de ses patients" on public.weight_tracking for delete
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = weight_tracking.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );
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

-- ── HEALTH_RECORDS (002, 006, 030) ───────────────────────────────────
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
drop policy if exists "health_records: propriétaire modifie" on public.health_records;
create policy "health_records: propriétaire modifie" on public.health_records for update
  using (exists (select 1 from public.animals where id = health_records.animal_id and owner_id = auth.uid()));
drop policy if exists "health_records: propriétaire supprime" on public.health_records;
create policy "health_records: propriétaire supprime" on public.health_records for delete
  using (exists (select 1 from public.animals where id = health_records.animal_id and owner_id = auth.uid()));
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

-- ============================================================
-- 2) DURCISSEMENT : animal_id verrouillé sur vaccines/health_records/
--    weight_tracking (que ce soit le propriétaire ou le médecin qui
--    modifie) — un dossier ne peut plus être déplacé vers un autre
--    animal, propriétaire ou patient une fois créé. Trigger BEFORE
--    UPDATE plutôt que WITH CHECK pour couvrir toutes les policies
--    UPDATE (propriétaire ET médecin) d'un coup, pattern identique à
--    079/080.
-- ============================================================

create or replace function prevent_animal_record_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.animal_id is distinct from old.animal_id) and not is_admin() then
    new.animal_id := old.animal_id;
  end if;
  return new;
end;
$$;

drop trigger if exists vaccines_prevent_reassignment on public.vaccines;
create trigger vaccines_prevent_reassignment
before update on public.vaccines
for each row execute function prevent_animal_record_reassignment();

drop trigger if exists health_records_prevent_reassignment on public.health_records;
create trigger health_records_prevent_reassignment
before update on public.health_records
for each row execute function prevent_animal_record_reassignment();

drop trigger if exists weight_tracking_prevent_reassignment on public.weight_tracking;
create trigger weight_tracking_prevent_reassignment
before update on public.weight_tracking
for each row execute function prevent_animal_record_reassignment();

-- ============================================================
-- 3) DURCISSEMENT : reviews.doctor_id / appointment_id verrouillés
--    (patient_id l'était déjà via le WITH CHECK de la policy "reviews:
--    patient modifie son avis", 011_reviews_independent_of_appointments.sql)
-- ============================================================

create or replace function prevent_review_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.doctor_id is distinct from old.doctor_id
      or new.appointment_id is distinct from old.appointment_id)
     and not is_admin() then
    new.doctor_id := old.doctor_id;
    new.appointment_id := old.appointment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_prevent_reassignment on public.reviews;
create trigger reviews_prevent_reassignment
before update on public.reviews
for each row execute function prevent_review_reassignment();
