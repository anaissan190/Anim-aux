-- ============================================================
-- ANIMÉAUX — Plusieurs métiers par praticien, étape 1/3 : schéma additif
-- (23/09/2026)
-- ============================================================
-- Un praticien peut désormais exercer plusieurs métiers de la liste
-- PRACTITIONER_TYPES (ex: éducateur canin ET naturopathe animalier) —
-- jusqu'ici doctors.specialty ne stockait qu'un seul texte.
--
-- Étape ADDITIVE volontairement : on ajoute `specialties text[]` sans
-- toucher à `specialty` (gardée telle quelle, dépréciée) tant que tout le
-- code applicatif n'a pas basculé sur le nouveau champ. Supprimer
-- `specialty` maintenant casserait net toute fonction SQL qui la
-- référence encore (admin_list_reviews, admin_list_appointments,
-- get_clinic_agenda) avant qu'elles aient été mises à jour. Le nettoyage
-- (suppression de `specialty` et des anciens champs *_specialty aplatis)
-- se fait dans une migration séparée, une fois le front vérifié en prod.
-- ============================================================

alter table public.doctors
  add column if not exists specialties text[] not null default '{}'::text[];

update public.doctors
  set specialties = case when specialty is null or specialty = '' then '{}'::text[] else array[specialty] end
  where specialties = '{}'::text[];

-- ── handle_new_user : écrit désormais aussi specialties ───────────────
-- Compatible avec l'ancien ET le nouveau format d'inscription : si
-- raw_user_meta_data contient un tableau JSON 'specialties', on l'utilise
-- (nouveau RegisterPage) ; sinon on retombe sur l'ancien champ 'specialty'
-- unique (fenêtre de déploiement où le front n'aurait pas encore basculé),
-- pour ne jamais casser une inscription en cours.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role_val public.user_role;
  specialties_val text[];
begin
  user_role_val := coalesce((NEW.raw_user_meta_data->>'role')::public.user_role, 'patient');

  insert into public.users (id, email, role, terms_accepted_at)
  values (
    NEW.id,
    NEW.email,
    user_role_val,
    case when (NEW.raw_user_meta_data->>'terms_accepted')::boolean is true then now() else null end
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, first_name, last_name)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'first_name', ''),
    coalesce(NEW.raw_user_meta_data->>'last_name', '')
  )
  on conflict (user_id) do nothing;

  if user_role_val = 'doctor' then
    if NEW.raw_user_meta_data->'specialties' is not null then
      select array_agg(value) into specialties_val
      from jsonb_array_elements_text(NEW.raw_user_meta_data->'specialties');
    else
      specialties_val := case
        when coalesce(NEW.raw_user_meta_data->>'specialty', '') = '' then '{}'::text[]
        else array[NEW.raw_user_meta_data->>'specialty']
      end;
    end if;

    insert into public.doctors (user_id, specialty, specialties, ethics_charter_accepted_at)
    values (
      NEW.id,
      coalesce(NEW.raw_user_meta_data->>'specialty', coalesce(specialties_val[1], '')),
      coalesce(specialties_val, '{}'::text[]),
      case when (NEW.raw_user_meta_data->>'ethics_charter_accepted')::boolean is true then now() else null end
    )
    on conflict (user_id) do nothing;
  end if;

  return NEW;
end;
$$;

-- ── admin_list_reviews : ajoute doctor_specialties ─────────────────────
create or replace function admin_list_reviews()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'rating', r.rating,
      'comment', r.comment,
      'created_at', r.created_at,
      'doctor_id', r.doctor_id,
      'doctor_name', coalesce(dp.first_name || ' ' || dp.last_name, ''),
      'doctor_specialty', d.specialty,
      'doctor_specialties', d.specialties,
      'patient_id', r.patient_id,
      'patient_name', coalesce(pp.first_name || ' ' || pp.last_name, '')
    ) order by r.created_at desc)
    from public.reviews r
    join public.doctors d on d.id = r.doctor_id
    left join public.profiles dp on dp.user_id = d.user_id
    left join public.profiles pp on pp.user_id = r.patient_id
  ), '[]'::jsonb);
end;
$$;

-- ── admin_list_appointments : ajoute doctor_specialties ─────────────────
create or replace function admin_list_appointments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'start_at', a.start_at,
      'end_at', a.end_at,
      'status', a.status,
      'reason', a.reason,
      'patient_id', a.patient_id,
      'patient_name', coalesce(pp.first_name || ' ' || pp.last_name, ''),
      'doctor_id', a.doctor_id,
      'doctor_name', coalesce(dp.first_name || ' ' || dp.last_name, ''),
      'doctor_specialty', d.specialty,
      'doctor_specialties', d.specialties
    ) order by a.start_at desc)
    from (
      select * from public.appointments order by created_at desc limit 500
    ) a
    join public.doctors d on d.id = a.doctor_id
    left join public.profiles dp on dp.user_id = d.user_id
    left join public.profiles pp on pp.user_id = a.patient_id
  ), '[]'::jsonb);
end;
$$;

-- ── get_clinic_agenda : ajoute doctor_specialties (change le type de
--    retour, donc drop obligatoire avant recreate — même contrainte que
--    089) ───────────────────────────────────────────────────────────────
drop function if exists public.get_clinic_agenda(uuid, timestamptz, timestamptz);

create or replace function public.get_clinic_agenda(p_clinic_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, start_at timestamptz, end_at timestamptz, status appointment_status, reason text,
  doctor_id uuid, doctor_first_name text, doctor_last_name text, doctor_specialty text,
  doctor_specialties text[],
  patient_first_name text, patient_last_name text, animal_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.start_at, a.end_at, a.status, a.reason,
    d.id, dp.first_name, dp.last_name, d.specialty, d.specialties,
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

-- ── get_clinic_team (fiche publique d'un cabinet, ClinicPage.tsx) :
--    specialty text -> specialties text[], même contrainte "drop avant
--    recreate" pour un changement de type de retour ────────────────────
drop function if exists public.get_clinic_team(uuid);

create or replace function public.get_clinic_team(p_clinic_id uuid)
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
  order by p.first_name
$$;
grant execute on function public.get_clinic_team(uuid) to anon, authenticated;

-- ── Reste volontairement non migré ici (colonne `specialty` conservée
--    pour ces consommateurs, restée synchronisée avec le PREMIER métier
--    via useUpdateDoctor — voir commentaire dans useData.ts) : search_clinics
--    (recherche de cabinet par spécialité, migration 039) et les RPC admin
--    admin_list_pending_doctors/admin_list_doctors_by_status/
--    admin_doctor_detail/admin_clinic_detail/admin_list_reports. Aucune ne
--    casse (specialty existe toujours), elles n'affichent/ne filtrent
--    simplement que le premier métier d'un praticien à plusieurs
--    casquettes — à généraliser dans une prochaine passe.
notify pgrst, 'reload schema';
