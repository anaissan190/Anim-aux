-- Deux fonctionnalités manquantes signalées par les testeurs :
-- 1) Impossible de supprimer son compte.
-- 2) Le créateur d'un cabinet ne peut pas retirer un membre.

-- ============================================================
-- 1) Suppression de compte
-- ============================================================
-- `appointments.patient_id` et `appointments.doctor_id` sont en
-- "on delete restrict" (voulu à l'origine pour ne jamais perdre
-- l'historique des RDV) : ça empêchait purement et simplement toute
-- suppression de compte dès qu'un RDV existait. On supprime donc
-- explicitement les RDV (et tout ce qui n'est pas garanti d'être en
-- cascade sur les tables créées hors des migrations committées : animals,
-- vaccines, weight_tracking, health_records, clinics, clinic_members,
-- clinic_services) avant de supprimer l'utilisateur. Le reste
-- (profiles, doctors, messages, notifications, reviews) est bien en
-- "on delete cascade" depuis public.users / auth.users et se nettoie tout
-- seul à la suppression finale de auth.users.

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

  -- Cabinet dont l'utilisateur est le créateur : supprimé entièrement
  -- (les autres membres perdent l'accès à l'agenda partagé).
  delete from clinic_services where clinic_id in (select id from clinics where owner_id = v_uid);
  delete from clinic_members  where clinic_id in (select id from clinics where owner_id = v_uid);
  delete from clinics where owner_id = v_uid;

  -- Simple adhésion à un cabinet dont on n'est pas le créateur
  if v_doctor_id is not null then
    delete from clinic_members where doctor_id = v_doctor_id;
  end if;

  -- Dossiers de santé des animaux dont l'utilisateur est propriétaire
  delete from vaccines        where animal_id in (select id from animals where owner_id = v_uid);
  delete from weight_tracking where animal_id in (select id from animals where owner_id = v_uid);
  delete from health_records  where animal_id in (select id from animals where owner_id = v_uid);
  delete from animals where owner_id = v_uid;

  -- Rendez-vous : à supprimer avant de pouvoir supprimer l'utilisateur ou
  -- le praticien (contrainte "on delete restrict").
  delete from appointments where patient_id = v_uid or doctor_id = v_doctor_id;

  if v_doctor_id is not null then
    delete from blocked_slots  where doctor_id = v_doctor_id;
    delete from availabilities where doctor_id = v_doctor_id;
  end if;

  -- Supprime le compte auth : cascade vers public.users, profiles, doctors,
  -- messages, notifications, reviews.
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- 2) Retirer un membre du cabinet
-- ============================================================
-- SECURITY DEFINER : on ne sait pas si le RLS de clinic_members (créé hors
-- migrations committées) autorise le créateur à supprimer la ligne d'un
-- AUTRE membre — même famille de bug que "Rejoindre un cabinet". On
-- vérifie nous-mêmes que l'appelant est bien le créateur du cabinet avant
-- de supprimer, et on interdit de se retirer soi-même par ce biais.

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
