-- ============================================================
-- ANIMÉAUX — Géolocalisation des cabinets
-- Ajoute lat/lng sur `clinics` (les praticiens individuels les ont déjà,
-- voir 001_schema.sql) pour permettre la recherche "autour de moi".
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

alter table public.clinics
  add column if not exists lat decimal(9,6),
  add column if not exists lng decimal(9,6);

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

-- Force PostgREST à recharger son cache de schéma (utile après une reprise
-- de pause du projet, où le cache peut rester périmé et renvoyer des 400/404
-- sur des tables/fonctions pourtant existantes).
notify pgrst, 'reload schema';
