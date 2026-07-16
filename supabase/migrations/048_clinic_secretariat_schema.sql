-- ============================================================
-- ANIMÉAUX — Espace secrétariat de cabinet (suite de la migration 047,
-- à exécuter séparément car ALTER TYPE ... ADD VALUE ne peut pas être
-- utilisé dans la même transaction qu'une requête qui référence la
-- nouvelle valeur).
--
-- Table clinic_staff : rattache un compte secrétariat à un cabinet, sans
-- toucher clinic_members (FK dure vers doctors, incompatible) ni ses
-- policies (déjà fragiles, cf. migrations 040/041). Aucune policy insert/
-- update/delete côté client : seule l'Edge Function invite-clinic-
-- secretary (service role, RLS bypass) y écrit.
-- ============================================================

-- is_clinic_owner n'existe pas sur ce projet (elle avait été créée en
-- migration 041 sur l'ancien projet Supabase abandonné, jamais sur
-- celui-ci) — on la (re)crée ici, de façon idempotente, plutôt que de
-- supposer son existence.
create or replace function public.is_clinic_owner(p_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from clinics where id = p_clinic_id and owner_id = auth.uid())
$$;

grant execute on function public.is_clinic_owner(uuid) to authenticated;

create table if not exists public.clinic_staff (
  id uuid default uuid_generate_v4() primary key,
  clinic_id uuid references public.clinics(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  invited_by uuid references public.users(id),
  created_at timestamptz default now(),
  unique (clinic_id, user_id)
);

alter table public.clinic_staff enable row level security;

drop policy if exists "clinic_staff: owner et soi-même voient" on public.clinic_staff;
create policy "clinic_staff: owner et soi-même voient" on public.clinic_staff for select using (
  is_clinic_owner(clinic_id) or user_id = auth.uid()
);

-- Miroir de is_clinic_owner (migration 041), pour autoriser un compte
-- secrétariat dans les RPC de lecture partagée du cabinet.
create or replace function public.is_clinic_staff(p_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from clinic_staff where clinic_id = p_clinic_id and user_id = auth.uid())
$$;

grant execute on function public.is_clinic_staff(uuid) to authenticated;

-- Cabinet de la secrétaire connectée, pour amorcer son tableau de bord.
create or replace function public.get_my_clinic_staff_info()
returns table (clinic_id uuid, name text, logo_url text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.logo_url
  from clinic_staff cs
  join clinics c on c.id = cs.clinic_id
  where cs.user_id = auth.uid()
$$;

grant execute on function public.get_my_clinic_staff_info() to authenticated;

-- Liste des secrétaires invitées par le propriétaire du cabinet (onglet
-- Secrétariat du tableau de bord praticien) — autorisé au propriétaire
-- uniquement, avec leurs infos de profil.
create or replace function public.get_clinic_staff_list(p_clinic_id uuid)
returns table (user_id uuid, first_name text, last_name text, email text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select cs.user_id, p.first_name, p.last_name, u.email, cs.created_at
  from clinic_staff cs
  join users u on u.id = cs.user_id
  left join profiles p on p.user_id = cs.user_id
  where cs.clinic_id = p_clinic_id
    and is_clinic_owner(p_clinic_id)
  order by cs.created_at
$$;

grant execute on function public.get_clinic_staff_list(uuid) to authenticated;

-- Agenda du cabinet (tous les praticiens membres) sur une période donnée —
-- autorisé au propriétaire, à un membre secrétariat, ou à un praticien du
-- même cabinet.
create or replace function public.get_clinic_agenda(p_clinic_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, start_at timestamptz, end_at timestamptz, status appointment_status, reason text,
  doctor_id uuid, doctor_first_name text, doctor_last_name text,
  patient_first_name text, patient_last_name text, animal_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.start_at, a.end_at, a.status, a.reason,
    d.id, dp.first_name, dp.last_name,
    pp.first_name, pp.last_name, an.name
  from appointments a
  join doctors d on d.id = a.doctor_id
  join profiles dp on dp.user_id = d.user_id
  left join profiles pp on pp.user_id = a.patient_id
  left join appointment_animals aa on aa.appointment_id = a.id
  left join animals an on an.id = aa.animal_id
  where d.id in (select doctor_id from clinic_members where clinic_id = p_clinic_id)
    and a.start_at >= p_from and a.start_at < p_to
    and (is_clinic_owner(p_clinic_id) or is_clinic_staff(p_clinic_id) or exists (
      select 1 from clinic_members cm join doctors d2 on d2.id = cm.doctor_id
      where cm.clinic_id = p_clinic_id and d2.user_id = auth.uid()
    ))
  order by a.start_at
$$;

grant execute on function public.get_clinic_agenda(uuid, timestamptz, timestamptz) to authenticated;

-- Patientèle agrégée du cabinet (tous les animaux des patients de tous les
-- praticiens membres) — même autorisation que get_clinic_agenda.
create or replace function public.get_clinic_patients(p_clinic_id uuid)
returns table (
  animal_id uuid, animal_name text, species text,
  owner_first_name text, owner_last_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct an.id, an.name, an.species, p.first_name, p.last_name
  from appointments a
  join animals an on an.owner_id = a.patient_id
  join profiles p on p.user_id = a.patient_id
  where a.doctor_id in (select doctor_id from clinic_members where clinic_id = p_clinic_id)
    and a.status <> 'cancelled'
    and (is_clinic_owner(p_clinic_id) or is_clinic_staff(p_clinic_id) or exists (
      select 1 from clinic_members cm join doctors d2 on d2.id = cm.doctor_id
      where cm.clinic_id = p_clinic_id and d2.user_id = auth.uid()
    ))
  order by p.last_name, an.name
$$;

grant execute on function public.get_clinic_patients(uuid) to authenticated;

notify pgrst, 'reload schema';
