-- ============================================================
-- ANIMÉAUX — Cabinets : messages clairs, secrétariat réservé, équipe publique
-- (13/10/2026)
-- ============================================================
-- Suite de 127 (offres). Trois points relevés lors du nettoyage du 13/10 :
--
-- 1. Message de limite lisible : le trigger de 127 répondait « nombre maximum de
--    praticiens (1) », peu parlant. Il distingue maintenant un cabinet non activé
--    d'un cabinet complet.
-- 2. Le secrétariat est réservé aux cabinets abonnés (clinics.plan = 'cabinet').
--    La fonction Edge invite-clinic-secretary refuse AVANT de créer le compte ;
--    ce trigger est le filet côté base pour toute autre voie d'insertion.
-- 3. Page publique d'un cabinet : get_clinic_team renvoie tous les membres (la
--    secrétaire et le propriétaire en ont besoin), donc un praticien masqué ou non
--    vérifié y apparaissait. Nouvelle RPC get_clinic_public_team, limitée aux
--    praticiens vérifiés ET visibles, pour la page publique seulement.
--
-- Retour arrière :
--   drop trigger clinic_staff_enforce_plan on public.clinic_staff;
--   drop function public.get_clinic_public_team(uuid);
-- ============================================================

create or replace function public.enforce_clinic_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select plan into v_plan from public.clinics where id = new.clinic_id;
  select count(*) into v_count from public.clinic_members where clinic_id = new.clinic_id;
  v_max := case when v_plan = 'cabinet' then 5 else 1 end;
  if v_count >= v_max then
    if v_plan = 'cabinet' then
      raise exception 'Ce cabinet a déjà ses 5 praticiens.';
    else
      raise exception 'Ce cabinet n''est pas encore activé : son créateur doit activer l''abonnement cabinet pour accueillir d''autres praticiens.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_clinic_staff_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.clinics c where c.id = new.clinic_id and c.plan = 'cabinet') then
    raise exception 'Le secrétariat est réservé aux cabinets abonnés : activez l''abonnement cabinet.';
  end if;
  return new;
end;
$$;

drop trigger if exists clinic_staff_enforce_plan on public.clinic_staff;
create trigger clinic_staff_enforce_plan
before insert on public.clinic_staff
for each row execute function public.enforce_clinic_staff_plan();

create or replace function public.get_clinic_public_team(p_clinic_id uuid)
returns table (
  doctor_id uuid, specialties text[], consultation_price integer,
  average_rating numeric, review_count integer, is_verified boolean,
  first_name text, last_name text, avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select d.id, d.specialties, d.consultation_price, d.average_rating, d.review_count, d.is_verified,
    p.first_name, p.last_name, p.avatar_url
  from clinic_members cm
  join doctors d on d.id = cm.doctor_id
  join profiles p on p.user_id = d.user_id
  where cm.clinic_id = p_clinic_id
    and d.verification_status = 'verified'
    and d.is_listed
  order by p.first_name
$$;

grant execute on function public.get_clinic_public_team(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
