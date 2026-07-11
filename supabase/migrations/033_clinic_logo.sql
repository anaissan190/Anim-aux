-- ============================================================
-- ANIMÉAUX — Logo du cabinet
-- Permet à l'admin du cabinet d'ajouter une photo/logo, affiché sur la
-- fiche praticien publique (RPC get_doctor_clinic) et dans le dashboard.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

alter table public.clinics add column if not exists logo_url text;

-- Le type de retour change (nouvelle colonne) : `create or replace` seul
-- échoue dans ce cas, il faut d'abord supprimer l'ancienne version (même
-- pattern que la migration 022 pour le téléphone du cabinet).
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
