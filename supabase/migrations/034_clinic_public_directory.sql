-- ============================================================
-- ANIMÉAUX — Annuaire public des cabinets
-- Permet à un visiteur (non connecté ou non membre) de :
--  1) retrouver un cabinet dans les résultats de recherche
--     (comme un praticien individuel) ;
--  2) consulter la fiche d'un cabinet avec toute son équipe.
-- La RLS sur `clinics`/`clinic_members` ne permet de lire que les cabinets
-- dont on est déjà owner/membre (voir commentaire de la migration 019) —
-- donc, comme get_doctor_clinic et join_clinic_by_code, on passe par des
-- RPC SECURITY DEFINER pour la partie publique.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- Recherche de cabinets par ville et/ou spécialité d'un des membres —
-- équivalent de la recherche de praticiens individuels (useDoctors), mais
-- groupé par cabinet.
create or replace function public.search_clinics(p_city text default null, p_specialty text default null)
returns table (
  id uuid, name text, address text, city text, phone text, logo_url text,
  member_count bigint, specialties text[], average_rating numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone, c.logo_url,
    count(distinct cm.doctor_id) as member_count,
    array_agg(distinct d.specialty) filter (where d.specialty is not null) as specialties,
    round(avg(d.average_rating), 2) as average_rating
  from clinics c
  join clinic_members cm on cm.clinic_id = c.id
  join doctors d on d.id = cm.doctor_id
  where (p_city is null or p_city = '' or c.city ilike '%' || p_city || '%')
    and (p_specialty is null or p_specialty = '' or d.specialty ilike '%' || p_specialty || '%')
  group by c.id
$$;

grant execute on function public.search_clinics(text, text) to anon, authenticated;

-- Fiche publique d'un cabinet (nom, adresse, logo...) pour /cabinet/:id
create or replace function public.get_clinic_info(p_clinic_id uuid)
returns table (id uuid, name text, address text, city text, phone text, logo_url text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone, c.logo_url
  from clinics c
  where c.id = p_clinic_id
$$;

grant execute on function public.get_clinic_info(uuid) to anon, authenticated;

-- Équipe complète d'un cabinet (tous les praticiens membres), pour afficher
-- leurs profils et permettre de cliquer vers leur fiche/réservation.
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
