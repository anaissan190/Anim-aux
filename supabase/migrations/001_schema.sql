-- ============================================================
-- PAWCARE — Schéma complet PostgreSQL + RLS
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- Extensions utiles
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- recherche floue

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type user_role as enum ('patient', 'doctor', 'admin');
create type appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type notification_type as enum ('appointment_confirmed', 'appointment_cancelled', 'appointment_reminder', 'new_message', 'new_review');

-- ============================================================
-- TABLE: users (étend auth.users de Supabase)
-- ============================================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  role user_role not null default 'patient',
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: profiles
-- ============================================================
create table public.profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade unique not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  avatar_url text,
  date_of_birth date,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TABLE: doctors
-- ============================================================
create table public.doctors (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade unique not null,
  specialty text not null default '',
  rpps_number text unique,
  bio text,
  consultation_price integer default 25, -- en euros
  address text,
  city text,
  lat decimal(9,6),
  lng decimal(9,6),
  is_verified boolean default false,
  average_rating decimal(3,2) default 0,
  review_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index pour la recherche
create index idx_doctors_specialty on public.doctors using gin(specialty gin_trgm_ops);
create index idx_doctors_city on public.doctors using gin(city gin_trgm_ops);

-- ============================================================
-- TABLE: availabilities
-- ============================================================
create table public.availabilities (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Dimanche, 1=Lundi...
  start_time time not null,
  end_time time not null,
  slot_duration_minutes integer not null default 30,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: blocked_slots (congés, indisponibilités)
-- ============================================================
create table public.blocked_slots (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: appointments
-- ============================================================
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  patient_id uuid references public.users(id) on delete restrict not null,
  doctor_id uuid references public.doctors(id) on delete restrict not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status appointment_status default 'pending',
  reason text,
  notes text, -- notes internes du médecin, invisibles au patient
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Un seul RDV par créneau par médecin
  constraint no_double_booking unique (doctor_id, start_at)
);

create index idx_appointments_patient on public.appointments(patient_id);
create index idx_appointments_doctor on public.appointments(doctor_id);
create index idx_appointments_start on public.appointments(start_at);

-- ============================================================
-- TABLE: reviews
-- ============================================================
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references public.appointments(id) on delete cascade unique not null,
  patient_id uuid references public.users(id) on delete cascade not null,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- Mise à jour automatique de la note moyenne du médecin
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

create trigger trg_update_rating
after insert or update on public.reviews
for each row execute function update_doctor_rating();

-- ============================================================
-- TABLE: messages
-- ============================================================
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.users(id) on delete cascade not null,
  receiver_id uuid references public.users(id) on delete cascade not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_messages_sender on public.messages(sender_id);
create index idx_messages_receiver on public.messages(receiver_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  type notification_type not null,
  title text not null,
  body text not null,
  is_read boolean default false,
  related_id uuid, -- ID du RDV ou message concerné
  created_at timestamptz default now()
);

create index idx_notifications_user on public.notifications(user_id, is_read);

-- ============================================================
-- TRIGGER: créer automatiquement user + profile + doctor à l'inscription
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  user_role_val user_role;
begin
  user_role_val := coalesce((NEW.raw_user_meta_data->>'role')::user_role, 'patient');

  insert into public.users (id, email, role)
  values (NEW.id, NEW.email, user_role_val)
  on conflict (id) do nothing;

  insert into public.profiles (user_id, first_name, last_name)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'first_name', ''),
    coalesce(NEW.raw_user_meta_data->>'last_name', '')
  )
  on conflict (user_id) do nothing;

  if user_role_val = 'doctor' then
    insert into public.doctors (user_id, specialty)
    values (NEW.id, coalesce(NEW.raw_user_meta_data->>'specialty', ''))
    on conflict (user_id) do nothing;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- USERS
alter table public.users enable row level security;
create policy "users: voir son propre profil" on public.users for select using (auth.uid() = id);
create policy "users: admin voit tout" on public.users for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- PROFILES
alter table public.profiles enable row level security;
create policy "profiles: voir le sien" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: modifier le sien" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles: médecins visibles" on public.profiles for select using (
  exists (select 1 from public.doctors where user_id = profiles.user_id)
);

-- DOCTORS
alter table public.doctors enable row level security;
create policy "doctors: lecture publique" on public.doctors for select using (true);
create policy "doctors: modifier son propre profil" on public.doctors for update using (auth.uid() = user_id);

-- AVAILABILITIES
alter table public.availabilities enable row level security;
create policy "availabilities: lecture publique" on public.availabilities for select using (true);
create policy "availabilities: médecin gère les siennes" on public.availabilities
  for all using (
    auth.uid() = (select user_id from public.doctors where id = doctor_id)
  );

-- BLOCKED SLOTS
alter table public.blocked_slots enable row level security;
create policy "blocked_slots: lecture publique" on public.blocked_slots for select using (true);
create policy "blocked_slots: médecin gère les siens" on public.blocked_slots
  for all using (
    auth.uid() = (select user_id from public.doctors where id = doctor_id)
  );

-- APPOINTMENTS
alter table public.appointments enable row level security;
create policy "appointments: patient voit les siens" on public.appointments for select using (
  auth.uid() = patient_id
);
create policy "appointments: médecin voit les siens" on public.appointments for select using (
  auth.uid() = (select user_id from public.doctors where id = doctor_id)
);
create policy "appointments: patient peut créer" on public.appointments for insert with check (
  auth.uid() = patient_id
);
create policy "appointments: patient peut annuler le sien" on public.appointments for update using (
  auth.uid() = patient_id and status in ('pending', 'confirmed')
);
create policy "appointments: médecin peut modifier" on public.appointments for update using (
  auth.uid() = (select user_id from public.doctors where id = doctor_id)
);

-- REVIEWS
alter table public.reviews enable row level security;
create policy "reviews: lecture publique" on public.reviews for select using (true);
create policy "reviews: patient crée après RDV" on public.reviews for insert with check (
  auth.uid() = patient_id and
  exists (
    select 1 from public.appointments
    where id = appointment_id and patient_id = auth.uid() and status = 'completed'
  )
);

-- MESSAGES
alter table public.messages enable row level security;
create policy "messages: sender ou receiver" on public.messages for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);
create policy "messages: envoyer" on public.messages for insert with check (
  auth.uid() = sender_id
);
create policy "messages: marquer lu" on public.messages for update using (
  auth.uid() = receiver_id
);

-- NOTIFICATIONS
alter table public.notifications enable row level security;
create policy "notifications: voir les siennes" on public.notifications for select using (
  auth.uid() = user_id
);
create policy "notifications: marquer lue" on public.notifications for update using (
  auth.uid() = user_id
);

-- ============================================================
-- DONNÉES DE DÉMONSTRATION (développement uniquement)
-- ============================================================
-- Les vraies données seront créées via l'interface.
-- Exemple de spécialités pour l'autocomplétion :
create table if not exists public.specialties (
  id serial primary key,
  name text unique not null
);

insert into public.specialties (name) values
('Médecine générale'), ('Cardiologie'), ('Dermatologie'),
('Gynécologie'), ('Ophtalmologie'), ('Orthopédie'),
('Pédiatrie'), ('Psychiatrie'), ('Radiologie'),
('Rhumatologie'), ('Urologie'), ('Neurologie'),
('Endocrinologie'), ('Gastro-entérologie'), ('Pneumologie')
on conflict do nothing;

alter table public.specialties enable row level security;
create policy "specialties: lecture publique" on public.specialties for select using (true);
