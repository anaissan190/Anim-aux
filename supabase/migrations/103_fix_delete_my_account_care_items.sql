-- ============================================================
-- ANIMÉAUX — Corrige delete_my_account() cassée par le renommage
-- vaccines -> care_items (23/09/2026)
-- ============================================================
-- Repéré en préparant la suppression de comptes de test ce soir :
-- delete_my_account() (039_recreate_incident_lost_tables.sql) référence
-- encore "vaccines", table renommée en "care_items" par la migration 100
-- plus tôt dans la nuit. Depuis, tout appel à cette fonction échoue avec
-- "relation vaccines does not exist" — la suppression de compte en
-- self-service (Mon profil > Supprimer mon compte) est cassée pour
-- absolument tous les utilisateurs, pas seulement les comptes de test.
--
-- Corrigé à l'identique, seul le nom de table change.
-- ============================================================

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

  delete from care_items      where animal_id in (select id from animals where owner_id = v_uid);
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

notify pgrst, 'reload schema';
