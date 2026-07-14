-- ============================================================
-- ANIMÉAUX — Reconstruction après incident Supabase (13-14/07/2026)
-- 8 tables ont disparu suite à un incident plateforme Supabase lors
-- d'une mise en pause/reprise de projet ("Project status change
-- failures in multiple regions") : clinics, clinic_members,
-- clinic_services, reviews, blocked_slots, appointment_animals,
-- appointment_documents, animal_documents.
--
-- Aucune sauvegarde n'était disponible (plan gratuit) : la STRUCTURE
-- est reconstruite ici à l'identique (colonnes, RLS, index, fonctions)
-- à partir des migrations déjà committées quand elles existaient, ou
-- reconstruite au mieux à partir du code applicatif pour clinics/
-- clinic_members/clinic_services (tables créées à l'origine
-- directement dans Supabase, jamais committées). Le CONTENU (avis,
-- cabinets, documents déjà envoyés, liens RDV↔animal) est
-- définitivement perdu.
--
-- À exécuter en une fois dans Supabase → SQL Editor → Run.
-- ============================================================

-- ============================================================
-- 1) REVIEWS (définition d'origine : 001_schema.sql, 007, 011, 013)
-- ============================================================
create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references public.appointments(id) on delete cascade unique,
  patient_id uuid references public.users(id) on delete cascade not null,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create or replace function update_doctor_rating()
returns trigger as $$
begin
  update public.doctors set
    average_rating = (select avg(rating) from public.reviews where doctor_id = NEW.doctor_id),
    review_count   = (select count(*) from public.reviews where doctor_id = NEW.doctor_id)
  where id = NEW.doctor_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_update_rating on public.reviews;
create trigger trg_update_rating
after insert or update on public.reviews
for each row execute function update_doctor_rating();

alter table public.reviews enable row level security;
drop policy if exists "reviews: lecture publique" on public.reviews;
create policy "reviews: lecture publique" on public.reviews for select using (true);
drop policy if exists "reviews: patient crée un avis" on public.reviews;
create policy "reviews: patient crée un avis" on public.reviews for insert with check (auth.uid() = patient_id);
drop policy if exists "reviews: patient modifie son avis" on public.reviews;
create policy "reviews: patient modifie son avis" on public.reviews for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- ============================================================
-- 2) BLOCKED_SLOTS (définition d'origine : 001_schema.sql, 015)
-- ============================================================
create table if not exists public.blocked_slots (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz default now()
);

alter table public.blocked_slots enable row level security;
drop policy if exists "blocked_slots: lecture publique" on public.blocked_slots;
create policy "blocked_slots: lecture publique" on public.blocked_slots for select using (true);
drop policy if exists "blocked_slots: médecin gère les siens" on public.blocked_slots;
create policy "blocked_slots: médecin gère les siens" on public.blocked_slots
  for all using (auth.uid() = (select user_id from public.doctors where id = doctor_id))
  with check (auth.uid() = (select user_id from public.doctors where id = doctor_id));

-- ============================================================
-- 2 bis) CLINICS / CLINIC_MEMBERS / CLINIC_SERVICES — tables nues
-- Créées ici (sans policies pour l'instant) car les sections suivantes
-- (appointment_animals, animal_documents, appointment_documents) ont des
-- policies "cabinet" qui référencent déjà clinic_members. Ces 3 tables
-- avaient été créées directement dans Supabase à l'origine (jamais
-- committées) — reconstruction au mieux à partir de tout ce que le code
-- applicatif (src/hooks/useData.ts) et les RPC (019-024, 033, 034)
-- attendent comme colonnes et permissions. Les policies elles-mêmes sont
-- ajoutées plus bas (section 7), une fois les 3 tables toutes créées.
-- ============================================================
create table if not exists public.clinics (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  address text,
  city text,
  phone text,
  logo_url text,
  invite_code text unique not null,
  lat decimal(9,6),
  lng decimal(9,6),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.clinic_members (
  id uuid default uuid_generate_v4() primary key,
  clinic_id uuid references public.clinics(id) on delete cascade not null,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (clinic_id, doctor_id)
);

create table if not exists public.clinic_services (
  id uuid default uuid_generate_v4() primary key,
  clinic_id uuid references public.clinics(id) on delete cascade not null,
  doctor_id uuid references public.doctors(id) on delete cascade,
  name text not null,
  price numeric,
  duration text,
  created_at timestamptz default now()
);

create index if not exists idx_clinic_members_doctor on public.clinic_members(doctor_id);
create index if not exists idx_clinic_members_clinic on public.clinic_members(clinic_id);

-- ============================================================
-- 3) Colonne appointments.animal_id (définition d'origine : 002)
-- Non utilisée par le code actuel (remplacée par appointment_animals),
-- restaurée uniquement pour la parité de schéma.
-- ============================================================
alter table public.appointments add column if not exists animal_id uuid references public.animals(id) on delete set null;
create index if not exists idx_appointments_animal on public.appointments(animal_id);

-- ============================================================
-- 4) APPOINTMENT_ANIMALS (définition d'origine : 012, RLS complétée par 029)
-- ============================================================
create table if not exists public.appointment_animals (
  appointment_id uuid references public.appointments(id) on delete cascade,
  animal_id      uuid references public.animals(id) on delete cascade,
  created_at     timestamptz default now(),
  primary key (appointment_id, animal_id)
);

alter table public.appointment_animals enable row level security;

drop policy if exists "appointment_animals: lecture patient ou praticien" on public.appointment_animals;
create policy "appointment_animals: lecture patient ou praticien" on public.appointment_animals for select using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_animals.appointment_id
      and (
        a.patient_id = auth.uid()
        or a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      )
  )
);

drop policy if exists "appointment_animals: patient peut lier ses animaux" on public.appointment_animals;
create policy "appointment_animals: patient peut lier ses animaux" on public.appointment_animals for insert with check (
  exists (select 1 from public.appointments a where a.id = appointment_animals.appointment_id and a.patient_id = auth.uid())
);

drop policy if exists "appointment_animals: patient peut supprimer un lien" on public.appointment_animals;
create policy "appointment_animals: patient peut supprimer un lien" on public.appointment_animals for delete using (
  exists (select 1 from public.appointments a where a.id = appointment_animals.appointment_id and a.patient_id = auth.uid())
);

-- RLS étendue "cabinet" (029) : un confrère du même cabinet que le
-- praticien du RDV peut aussi voir le lien vers l'animal.
drop policy if exists "appointment_animals: médecin voit celles du cabinet" on public.appointment_animals;
create policy "appointment_animals: médecin voit celles du cabinet" on public.appointment_animals for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.id = appointment_animals.appointment_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ============================================================
-- 5) ANIMAL_DOCUMENTS (définition d'origine : 025, colonne 032, RLS étendue 030)
-- ============================================================
create table if not exists public.animal_documents (
  id          uuid primary key default gen_random_uuid(),
  animal_id   uuid not null references public.animals(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_url    text not null,
  file_name   text not null,
  file_type   text,
  label       text,
  document_type text not null default 'autre' check (document_type in ('ordonnance', 'analyse', 'radio', 'certificat', 'autre')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_animal_documents_animal on public.animal_documents(animal_id);
create index if not exists idx_animal_documents_type on public.animal_documents(document_type);

alter table public.animal_documents enable row level security;

drop policy if exists "animal_documents: propriétaire voit les siens" on public.animal_documents;
create policy "animal_documents: propriétaire voit les siens" on public.animal_documents for select using (
  exists (select 1 from public.animals an where an.id = animal_documents.animal_id and an.owner_id = auth.uid())
);

drop policy if exists "animal_documents: médecin voit ceux des animaux de ses patients" on public.animal_documents;
create policy "animal_documents: médecin voit ceux des animaux de ses patients" on public.animal_documents for select using (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = animal_documents.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

drop policy if exists "animal_documents: propriétaire ajoute" on public.animal_documents;
create policy "animal_documents: propriétaire ajoute" on public.animal_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.animals an where an.id = animal_documents.animal_id and an.owner_id = auth.uid())
);

drop policy if exists "animal_documents: médecin peut ajouter" on public.animal_documents;
create policy "animal_documents: médecin peut ajouter" on public.animal_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = animal_documents.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

drop policy if exists "animal_documents: suppression par l'auteur" on public.animal_documents;
create policy "animal_documents: suppression par l'auteur" on public.animal_documents for delete using (
  uploaded_by = auth.uid()
);

-- RLS étendue "cabinet" (030) : un confrère du cabinet voit/ajoute aussi.
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

-- ============================================================
-- 6) APPOINTMENT_DOCUMENTS (définition d'origine : 025, RLS étendue 028)
-- ============================================================
create table if not exists public.appointment_documents (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  uploaded_by    uuid not null references auth.users(id) on delete cascade,
  file_url       text not null,
  file_name      text not null,
  file_type      text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_appointment_documents_appointment on public.appointment_documents(appointment_id);

alter table public.appointment_documents enable row level security;

drop policy if exists "appointment_documents: patient voit les siens" on public.appointment_documents;
create policy "appointment_documents: patient voit les siens" on public.appointment_documents for select using (
  exists (select 1 from public.appointments a where a.id = appointment_documents.appointment_id and a.patient_id = auth.uid())
);

drop policy if exists "appointment_documents: médecin voit ceux de ses RDV" on public.appointment_documents;
create policy "appointment_documents: médecin voit ceux de ses RDV" on public.appointment_documents for select using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_documents.appointment_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

drop policy if exists "appointment_documents: patient ajoute" on public.appointment_documents;
create policy "appointment_documents: patient ajoute" on public.appointment_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.appointments a where a.id = appointment_documents.appointment_id and a.patient_id = auth.uid())
);

drop policy if exists "appointment_documents: suppression par l'auteur" on public.appointment_documents;
create policy "appointment_documents: suppression par l'auteur" on public.appointment_documents for delete using (
  uploaded_by = auth.uid()
);

-- RLS étendue "cabinet" (028) : un confrère du cabinet voit aussi.
drop policy if exists "appointment_documents: médecin voit celles du cabinet" on public.appointment_documents;
create policy "appointment_documents: médecin voit celles du cabinet" on public.appointment_documents for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.id = appointment_documents.appointment_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ============================================================
-- 7) CLINICS / CLINIC_MEMBERS / CLINIC_SERVICES — policies
-- (tables déjà créées plus haut, juste après blocked_slots, car
-- plusieurs policies des sections 4/5/6 ci-dessus référencent déjà
-- clinic_members).
-- ============================================================
alter table public.clinics enable row level security;

drop policy if exists "clinics: owner et membres voient" on public.clinics;
create policy "clinics: owner et membres voient" on public.clinics for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.clinic_members cm join public.doctors d on d.id = cm.doctor_id
    where cm.clinic_id = clinics.id and d.user_id = auth.uid()
  )
);
drop policy if exists "clinics: owner crée" on public.clinics;
create policy "clinics: owner crée" on public.clinics for insert with check (owner_id = auth.uid());
drop policy if exists "clinics: owner modifie" on public.clinics;
create policy "clinics: owner modifie" on public.clinics for update using (owner_id = auth.uid());
drop policy if exists "clinics: owner supprime" on public.clinics;
create policy "clinics: owner supprime" on public.clinics for delete using (owner_id = auth.uid());

alter table public.clinic_members enable row level security;

drop policy if exists "clinic_members: membres du même cabinet se voient" on public.clinic_members;
create policy "clinic_members: membres du même cabinet se voient" on public.clinic_members for select using (
  exists (
    select 1 from public.clinic_members cm2 join public.doctors d on d.id = cm2.doctor_id
    where cm2.clinic_id = clinic_members.clinic_id and d.user_id = auth.uid()
  )
  or exists (select 1 from public.clinics c where c.id = clinic_members.clinic_id and c.owner_id = auth.uid())
);
drop policy if exists "clinic_members: owner ajoute" on public.clinic_members;
create policy "clinic_members: owner ajoute" on public.clinic_members for insert with check (
  exists (select 1 from public.clinics c where c.id = clinic_members.clinic_id and c.owner_id = auth.uid())
);
drop policy if exists "clinic_members: owner supprime" on public.clinic_members;
create policy "clinic_members: owner supprime" on public.clinic_members for delete using (
  exists (select 1 from public.clinics c where c.id = clinic_members.clinic_id and c.owner_id = auth.uid())
);

alter table public.clinic_services enable row level security;

drop policy if exists "clinic_services: membres voient" on public.clinic_services;
create policy "clinic_services: membres voient" on public.clinic_services for select using (
  exists (
    select 1 from public.clinic_members cm join public.doctors d on d.id = cm.doctor_id
    where cm.clinic_id = clinic_services.clinic_id and d.user_id = auth.uid()
  )
  or exists (select 1 from public.clinics c where c.id = clinic_services.clinic_id and c.owner_id = auth.uid())
);
-- Pas de policy insert/update/delete directe : tout passe par les RPC
-- add_clinic_service / delete_clinic_service (security definer, ci-dessous).

-- ============================================================
-- 8) RLS "cabinet" sur les tables jamais perdues (profiles, animals,
-- vaccines, weight_tracking, health_records, appointments) — policies
-- dépendantes de clinic_members, potentiellement supprimées en cascade
-- avec la table. Version finale (030 pour la première série, 027 pour
-- appointments).
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
  )
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

drop policy if exists "appointments: médecin voit celles du cabinet" on public.appointments;
create policy "appointments: médecin voit celles du cabinet" on public.appointments for select using (
  exists (
    select 1
    from public.clinic_members cm_collegue
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where cm_collegue.doctor_id = appointments.doctor_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ============================================================
-- 9) Fonctions RPC "language sql" (cascade-supprimées avec les tables)
-- ============================================================
drop function if exists public.get_doctor_clinic(uuid);
create or replace function public.get_doctor_clinic(p_doctor_id uuid)
returns table (clinic_id uuid, clinic_name text, address text, city text, phone text, logo_url text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone, c.logo_url
  from clinic_members cm
  join clinics c on c.id = cm.clinic_id
  where cm.doctor_id = p_doctor_id
  limit 1;
$$;
grant execute on function public.get_doctor_clinic(uuid) to anon, authenticated;

create or replace function public.search_clinics(p_city text default null, p_specialty text default null)
returns table (
  id uuid, name text, address text, city text, phone text, logo_url text,
  member_count bigint, specialties text[], average_rating numeric,
  lat decimal(9,6), lng decimal(9,6)
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone, c.logo_url,
    count(distinct cm.doctor_id) as member_count,
    array_agg(distinct d.specialty) filter (where d.specialty is not null) as specialties,
    round(avg(d.average_rating), 2) as average_rating,
    c.lat, c.lng
  from clinics c
  join clinic_members cm on cm.clinic_id = c.id
  join doctors d on d.id = cm.doctor_id
  where (p_city is null or p_city = '' or c.city ilike '%' || p_city || '%')
    and (p_specialty is null or p_specialty = '' or d.specialty ilike '%' || p_specialty || '%')
  group by c.id
$$;
grant execute on function public.search_clinics(text, text) to anon, authenticated;

create or replace function public.get_clinic_info(p_clinic_id uuid)
returns table (id uuid, name text, address text, city text, phone text, logo_url text, lat decimal(9,6), lng decimal(9,6))
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone, c.logo_url, c.lat, c.lng
  from clinics c
  where c.id = p_clinic_id
$$;
grant execute on function public.get_clinic_info(uuid) to anon, authenticated;

create or replace function public.get_clinic_team(p_clinic_id uuid)
returns table (
  doctor_id uuid, specialty text, consultation_price integer,
  average_rating numeric, review_count integer, is_verified boolean,
  first_name text, last_name text, avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select d.id, d.specialty, d.consultation_price, d.average_rating, d.review_count, d.is_verified,
    p.first_name, p.last_name, p.avatar_url
  from clinic_members cm
  join doctors d on d.id = cm.doctor_id
  join profiles p on p.user_id = d.user_id
  where cm.clinic_id = p_clinic_id
  order by p.first_name
$$;
grant execute on function public.get_clinic_team(uuid) to anon, authenticated;

-- ============================================================
-- 10) Fonctions RPC "language plpgsql" (n'ont normalement pas été
-- supprimées par la disparition des tables, mais réaffirmées ici par
-- sécurité — sans effet si déjà correctes).
-- ============================================================
create or replace function public.join_clinic_by_code(p_invite_code text, p_doctor_id uuid)
returns table (clinic_id uuid, clinic_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  select c.id into v_clinic_id
  from clinics c
  where c.invite_code = upper(p_invite_code);

  if v_clinic_id is null then
    raise exception 'Code invalide ou cabinet introuvable';
  end if;

  if exists (
    select 1 from clinic_members cm
    where cm.clinic_id = v_clinic_id and cm.doctor_id = p_doctor_id
  ) then
    raise exception 'Vous êtes déjà membre de ce cabinet';
  end if;

  insert into clinic_members (clinic_id, doctor_id) values (v_clinic_id, p_doctor_id);

  return query select c.id, c.name from clinics c where c.id = v_clinic_id;
end;
$$;
grant execute on function public.join_clinic_by_code(text, uuid) to authenticated;

create or replace function public.remove_clinic_member(p_clinic_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_member_doctor_id uuid;
  v_caller_doctor_id uuid;
begin
  select clinic_id, doctor_id into v_clinic_id, v_member_doctor_id
  from clinic_members
  where id = p_clinic_member_id;

  if v_clinic_id is null then
    raise exception 'Membre introuvable';
  end if;

  if not exists (select 1 from clinics where id = v_clinic_id and owner_id = auth.uid()) then
    raise exception 'Seul le créateur du cabinet peut retirer un membre';
  end if;

  select id into v_caller_doctor_id from doctors where user_id = auth.uid();
  if v_member_doctor_id = v_caller_doctor_id then
    raise exception 'Vous ne pouvez pas vous retirer vous-même du cabinet';
  end if;

  delete from clinic_members where id = p_clinic_member_id;
end;
$$;
grant execute on function public.remove_clinic_member(uuid) to authenticated;

create or replace function public.add_clinic_service(p_clinic_id uuid, p_name text, p_price numeric, p_duration text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
begin
  select id into v_doctor_id from doctors where user_id = auth.uid();
  if v_doctor_id is null then
    raise exception 'Praticien introuvable';
  end if;

  if not exists (
    select 1 from clinic_members
    where clinic_id = p_clinic_id and doctor_id = v_doctor_id
  ) then
    raise exception 'Vous n''êtes pas membre de ce cabinet';
  end if;

  insert into clinic_services (clinic_id, doctor_id, name, price, duration)
  values (p_clinic_id, v_doctor_id, p_name, p_price, p_duration);
end;
$$;
grant execute on function public.add_clinic_service(uuid, text, numeric, text) to authenticated;

create or replace function public.delete_clinic_service(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_doctor_id uuid;
  v_clinic_id uuid;
  v_caller_doctor_id uuid;
begin
  select doctor_id, clinic_id into v_service_doctor_id, v_clinic_id
  from clinic_services where id = p_service_id;

  if v_clinic_id is null then
    raise exception 'Tarif introuvable';
  end if;

  select id into v_caller_doctor_id from doctors where user_id = auth.uid();

  if v_service_doctor_id is distinct from v_caller_doctor_id
     and not exists (select 1 from clinics where id = v_clinic_id and owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez supprimer que vos propres tarifs';
  end if;

  delete from clinic_services where id = p_service_id;
end;
$$;
grant execute on function public.delete_clinic_service(uuid) to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doctor_id uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  select id into v_doctor_id from doctors where user_id = v_uid;

  delete from clinic_services where clinic_id in (select id from clinics where owner_id = v_uid);
  delete from clinic_members  where clinic_id in (select id from clinics where owner_id = v_uid);
  delete from clinics where owner_id = v_uid;

  if v_doctor_id is not null then
    delete from clinic_members where doctor_id = v_doctor_id;
  end if;

  delete from vaccines        where animal_id in (select id from animals where owner_id = v_uid);
  delete from weight_tracking where animal_id in (select id from animals where owner_id = v_uid);
  delete from health_records  where animal_id in (select id from animals where owner_id = v_uid);
  delete from animals where owner_id = v_uid;

  delete from appointments where patient_id = v_uid or doctor_id = v_doctor_id;

  if v_doctor_id is not null then
    delete from blocked_slots  where doctor_id = v_doctor_id;
    delete from availabilities where doctor_id = v_doctor_id;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- 11) Reload du cache de schéma PostgREST
-- ============================================================
notify pgrst, 'reload schema';
