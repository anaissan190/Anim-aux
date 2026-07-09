-- ============================================================
-- ANIMÉAUX — Recréation de fonctions RPC critiques disparues
-- get_my_user_data, is_admin, is_doctor, get_my_doctor_id
-- n'existaient plus dans la base (constaté le 09/07/2026,
-- probablement lié à l'incident de capacité Supabase en cours).
-- Elles sont indispensables à la connexion et à plusieurs
-- politiques RLS. À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- Retourne { role, profile } de l'utilisateur connecté.
-- Utilisée à la connexion et dans onAuthStateChange (App.tsx / LoginPage.tsx).
create or replace function public.get_my_user_data()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'role', u.role,
    'profile', to_json(p.*)
  )
  into result
  from public.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid();

  return result;
end;
$$;

grant execute on function public.get_my_user_data() to authenticated;

-- Vérifie si l'utilisateur connecté est admin (utilisée dans plusieurs policies RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Vérifie si un uid donné est un praticien (utilisée dans les policies RLS)
create or replace function public.is_doctor(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.doctors where user_id = uid
  );
$$;

grant execute on function public.is_doctor(uuid) to authenticated;

-- Retourne l'id du praticien connecté (table doctors)
create or replace function public.get_my_doctor_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.doctors where user_id = auth.uid();
$$;

grant execute on function public.get_my_doctor_id() to authenticated;
