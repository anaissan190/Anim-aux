-- ============================================================
-- Dossier praticien exhaustif + données pour graphiques (vue d'ensemble)
-- ============================================================
-- admin_list_doctors_by_status() donne déjà un résumé (profil + documents)
-- pour les listes ; admin_doctor_detail() va plus loin pour la fiche
-- individuelle cliquée : coordonnées complètes, cabinet, et statistiques
-- de rendez-vous par statut. admin_platform_stats() est complété avec
-- l'évolution des inscriptions (8 dernières semaines) et la répartition
-- des rendez-vous par statut, pour les graphiques de la vue d'ensemble.

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
    'specialty', d.specialty,
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

grant execute on function admin_doctor_detail(uuid) to authenticated;

create or replace function admin_platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_admin() then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    'patients_count', (select count(*) from public.users where role = 'patient'),
    'doctors_count', (select count(*) from public.doctors),
    'doctors_pending', (select count(*) from public.doctors where verification_status = 'pending'),
    'doctors_verified', (select count(*) from public.doctors where verification_status = 'verified'),
    'doctors_rejected', (select count(*) from public.doctors where verification_status = 'rejected'),
    'secretaries_count', (select count(*) from public.users where role = 'secretary'),
    'clinics_count', (select count(*) from public.clinics),
    'appointments_total', (select count(*) from public.appointments),
    'appointments_upcoming', (select count(*) from public.appointments where start_at > now() and status in ('pending', 'confirmed')),
    'reviews_count', (select count(*) from public.reviews),
    'signups_weekly', (
      with weeks as (
        select generate_series(date_trunc('week', now()) - interval '7 week', date_trunc('week', now()), interval '1 week')::date as week_start
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'week_start', w.week_start,
        'doctors', (select count(*) from public.users u where u.role = 'doctor' and date_trunc('week', u.created_at)::date = w.week_start),
        'patients', (select count(*) from public.users u where u.role = 'patient' and date_trunc('week', u.created_at)::date = w.week_start)
      ) order by w.week_start), '[]'::jsonb)
      from weeks w
    ),
    'appointments_by_status', jsonb_build_object(
      'pending', (select count(*) from public.appointments where status = 'pending'),
      'confirmed', (select count(*) from public.appointments where status = 'confirmed'),
      'completed', (select count(*) from public.appointments where status = 'completed'),
      'cancelled', (select count(*) from public.appointments where status = 'cancelled'),
      'no_show', (select count(*) from public.appointments where status = 'no_show')
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function admin_platform_stats() to authenticated;
