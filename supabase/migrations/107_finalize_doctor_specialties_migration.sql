-- ============================================================
-- ANIMÉAUX — Plusieurs métiers par praticien, étape 3/3 : dernière
-- bascule + nettoyage de la colonne dépréciée (24/09/2026)
-- ============================================================
-- Migration 102 (23/09/2026) avait laissé volontairement 6 fonctions SQL
-- sur l'ancienne colonne `specialty` (texte unique) : la recherche de
-- cabinet par spécialité (search_clinics) et 5 vues admin
-- (admin_list_pending_doctors, admin_list_doctors_by_status,
-- admin_doctor_detail, admin_clinic_detail, admin_list_reports).
-- N'affichaient/ne filtraient jusqu'ici que le PREMIER métier d'un
-- praticien à plusieurs casquettes — rien de cassé, juste incomplet.
--
-- Cette migration bascule ces 6 fonctions sur `specialties` (tableau), et
-- retire aussi les champs "doctor_specialty"/"specialty" restés en double
-- dans handle_new_user/admin_list_reviews/admin_list_appointments/
-- get_clinic_agenda (migration 102) — condition nécessaire avant de
-- pouvoir enfin supprimer la colonne `specialty` elle-même, en toute fin
-- de fichier : Postgres refuse de supprimer une colonne encore
-- référencée par une fonction.
-- ============================================================

-- ── handle_new_user : n'écrit plus que specialties ─────────────────────
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

    insert into public.doctors (user_id, specialties, ethics_charter_accepted_at)
    values (
      NEW.id,
      coalesce(specialties_val, '{}'::text[]),
      case when (NEW.raw_user_meta_data->>'ethics_charter_accepted')::boolean is true then now() else null end
    )
    on conflict (user_id) do nothing;
  end if;

  return NEW;
end;
$$;

-- ── admin_list_reviews : retire doctor_specialty (double avec
--    doctor_specialties, migration 102) ────────────────────────────────
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

-- ── admin_list_appointments : retire doctor_specialty ────────────────────
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

-- ── get_clinic_agenda : retire doctor_specialty (change le type de
--    retour, donc drop obligatoire) ─────────────────────────────────────
drop function if exists public.get_clinic_agenda(uuid, timestamptz, timestamptz);

create or replace function public.get_clinic_agenda(p_clinic_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, start_at timestamptz, end_at timestamptz, status appointment_status, reason text,
  doctor_id uuid, doctor_first_name text, doctor_last_name text,
  doctor_specialties text[],
  patient_first_name text, patient_last_name text, animal_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.start_at, a.end_at, a.status, a.reason,
    d.id, dp.first_name, dp.last_name, d.specialties,
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

-- ── search_clinics : agrège/filtre désormais sur specialties (tableau
--    par praticien) via unnest, au lieu du texte unique specialty ──────
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
    array_agg(distinct s) filter (where s is not null) as specialties,
    round(avg(d.average_rating), 2) as average_rating,
    c.lat, c.lng
  from clinics c
  join clinic_members cm on cm.clinic_id = c.id
  join doctors d on d.id = cm.doctor_id
  left join lateral unnest(d.specialties) as s on true
  where (p_city is null or p_city = '' or c.city ilike '%' || p_city || '%')
    and (p_specialty is null or p_specialty = '' or exists (
      select 1 from unnest(d.specialties) sp where sp ilike '%' || p_specialty || '%'
    ))
  group by c.id
$$;
grant execute on function public.search_clinics(text, text) to anon, authenticated;

-- ── admin_list_pending_doctors ──────────────────────────────────────────
create or replace function admin_list_pending_doctors()
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
      'doctor_id', d.id,
      'user_id', d.user_id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'specialties', d.specialties,
      'email', u.email,
      'created_at', d.created_at,
      'documents', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', doc.id, 'file_url', doc.file_url, 'file_name', doc.file_name,
          'document_type', doc.document_type, 'created_at', doc.created_at
        ) order by doc.created_at asc), '[]'::jsonb)
        from public.doctor_verification_documents doc where doc.doctor_id = d.id
      )
    ) order by d.created_at asc)
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
    join public.users u on u.id = d.user_id
    where d.verification_status = 'pending'
  ), '[]'::jsonb);
end;
$$;

-- ── admin_list_doctors_by_status ─────────────────────────────────────────
create or replace function admin_list_doctors_by_status(p_status text default null)
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
      'doctor_id', d.id,
      'user_id', d.user_id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'specialties', d.specialties,
      'city', d.city,
      'email', u.email,
      'created_at', d.created_at,
      'verification_status', d.verification_status,
      'verification_rejected_reason', d.verification_rejected_reason,
      'average_rating', d.average_rating,
      'review_count', d.review_count,
      'documents', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', doc.id, 'file_url', doc.file_url, 'file_name', doc.file_name,
          'document_type', doc.document_type, 'created_at', doc.created_at
        ) order by doc.created_at asc), '[]'::jsonb)
        from public.doctor_verification_documents doc where doc.doctor_id = d.id
      )
    ) order by d.created_at desc)
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
    join public.users u on u.id = d.user_id
    where p_status is null or d.verification_status = p_status
  ), '[]'::jsonb);
end;
$$;

-- ── admin_clinic_detail ──────────────────────────────────────────────────
create or replace function admin_clinic_detail(p_clinic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select jsonb_build_object(
    'clinic_id', c.id,
    'name', c.name,
    'address', c.address,
    'city', c.city,
    'phone', c.phone,
    'logo_url', c.logo_url,
    'invite_code', c.invite_code,
    'owner_id', c.owner_id,
    'owner_name', coalesce(op.first_name || ' ' || op.last_name, ''),
    'owner_email', ou.email,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'doctor_id', d.id,
        'user_id', d.user_id,
        'first_name', dp.first_name,
        'last_name', dp.last_name,
        'specialties', d.specialties,
        'verification_status', d.verification_status,
        'joined_at', cm.joined_at,
        'is_owner', d.user_id = c.owner_id
      ) order by cm.joined_at asc), '[]'::jsonb)
      from public.clinic_members cm
      join public.doctors d on d.id = cm.doctor_id
      left join public.profiles dp on dp.user_id = d.user_id
      where cm.clinic_id = c.id
    ),
    'secretaries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', cs.user_id,
        'first_name', sp.first_name,
        'last_name', sp.last_name,
        'email', su.email
      )), '[]'::jsonb)
      from public.clinic_staff cs
      left join public.profiles sp on sp.user_id = cs.user_id
      left join public.users su on su.id = cs.user_id
      where cs.clinic_id = c.id
    ),
    'appointments_total', (
      select count(*) from public.appointments ap
      where ap.doctor_id in (select cm.doctor_id from public.clinic_members cm where cm.clinic_id = c.id)
    )
  )
  into result
  from public.clinics c
  left join public.profiles op on op.user_id = c.owner_id
  left join public.users ou on ou.id = c.owner_id
  where c.id = p_clinic_id;

  if result is null then
    raise exception 'Cabinet introuvable';
  end if;

  return result;
end;
$$;

-- ── admin_list_reports (target_preview pour un signalement de praticien) ─
create or replace function admin_list_reports()
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
      'target_type', r.target_type,
      'target_id', r.target_id,
      'reason', r.reason,
      'status', r.status,
      'admin_note', r.admin_note,
      'created_at', r.created_at,
      'resolved_at', r.resolved_at,
      'reporter_name', coalesce(rp.first_name || ' ' || rp.last_name, ''),
      'reporter_email', ru.email,
      'target_preview', case
        when r.target_type = 'review' then (
          select jsonb_build_object(
            'rating', rev.rating, 'comment', rev.comment,
            'doctor_name', coalesce(dp.first_name || ' ' || dp.last_name, ''),
            'doctor_id', rev.doctor_id
          )
          from public.reviews rev
          left join public.doctors d on d.id = rev.doctor_id
          left join public.profiles dp on dp.user_id = d.user_id
          where rev.id = r.target_id
        )
        when r.target_type = 'doctor' then (
          select jsonb_build_object(
            'doctor_name', coalesce(dp.first_name || ' ' || dp.last_name, ''),
            'specialties', d.specialties
          )
          from public.doctors d
          left join public.profiles dp on dp.user_id = d.user_id
          where d.id = r.target_id
        )
      end
    ) order by (r.status = 'pending') desc, r.created_at desc)
    from public.reports r
    left join public.users ru on ru.id = r.reporter_id
    left join public.profiles rp on rp.user_id = r.reporter_id
  ), '[]'::jsonb);
end;
$$;

-- ── admin_doctor_detail ──────────────────────────────────────────────────
create or replace function admin_doctor_detail(p_doctor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select jsonb_build_object(
    'doctor_id', d.id,
    'user_id', d.user_id,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'phone', p.phone,
    'avatar_url', p.avatar_url,
    'email', u.email,
    'is_suspended', u.is_suspended,
    'suspended_reason', u.suspended_reason,
    'specialties', d.specialties,
    'rpps_number', d.rpps_number,
    'bio', d.bio,
    'consultation_price', d.consultation_price,
    'address', d.address,
    'city', d.city,
    'accepted_species', d.accepted_species,
    'home_visit', d.home_visit,
    'average_rating', d.average_rating,
    'review_count', d.review_count,
    'verification_status', d.verification_status,
    'verification_rejected_reason', d.verification_rejected_reason,
    'created_at', d.created_at,
    'clinic', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'is_owner', c.owner_id = d.user_id)
      from public.clinic_members cm
      join public.clinics c on c.id = cm.clinic_id
      where cm.doctor_id = d.id
      limit 1
    ),
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', doc.id, 'file_url', doc.file_url, 'file_name', doc.file_name,
        'document_type', doc.document_type, 'created_at', doc.created_at
      ) order by doc.created_at asc), '[]'::jsonb)
      from public.doctor_verification_documents doc where doc.doctor_id = d.id
    ),
    'appointments_total', (select count(*) from public.appointments where doctor_id = d.id),
    'appointments_upcoming', (select count(*) from public.appointments where doctor_id = d.id and start_at > now() and status in ('pending', 'confirmed')),
    'appointments_completed', (select count(*) from public.appointments where doctor_id = d.id and status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments where doctor_id = d.id and status = 'cancelled'),
    'appointments_no_show', (select count(*) from public.appointments where doctor_id = d.id and status = 'no_show')
  )
  into result
  from public.doctors d
  join public.profiles p on p.user_id = d.user_id
  join public.users u on u.id = d.user_id
  where d.id = p_doctor_id;

  if result is null then
    raise exception 'Praticien introuvable';
  end if;

  return result;
end;
$$;

-- ── Nettoyage final : plus aucune fonction ne référence doctors.specialty,
--    on peut enfin la supprimer ────────────────────────────────────────
alter table public.doctors drop column if exists specialty;

notify pgrst, 'reload schema';
