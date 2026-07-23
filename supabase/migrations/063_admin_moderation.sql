-- ============================================================
-- Modération avancée : suppression d'avis, suspension de compte,
-- signalements, journal d'actions admin
-- ============================================================
-- Quatre briques indépendantes mais complémentaires :
--  1. users.is_suspended : un compte suspendu est déconnecté de force à la
--     prochaine vérification de session (voir get_my_user_data) et ne peut
--     plus se reconnecter tant qu'il n'est pas réactivé par un admin.
--  2. reports : signalement d'un avis ou d'un praticien par un utilisateur,
--     traité ensuite par un admin (résolu / rejeté).
--  3. admin_actions_log : trace de chaque action de modération (validation
--     de praticien déjà en place, mais aussi suppression d'avis, suspension,
--     traitement de signalement), utile si plusieurs personnes ont accès à
--     l'admin un jour.
--  4. admin_delete_review : suppression d'un avis, avec recalcul manuel de
--     la note moyenne du praticien (le trigger existant trg_update_rating
--     ne couvre que insert/update, jamais delete).

-- ── 1. Suspension de compte ─────────────────────────────────────────────
alter table public.users add column if not exists is_suspended boolean not null default false;
alter table public.users add column if not exists suspended_reason text;
alter table public.users add column if not exists suspended_at timestamptz;

-- ── 2. Signalements ──────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.users(id) on delete cascade not null,
  target_type text not null check (target_type in ('review', 'doctor')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  admin_note text,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.reports enable row level security;
-- Aucune policy client : toute lecture/écriture passe par les RPC
-- SECURITY DEFINER ci-dessous (create_report, admin_list_reports,
-- admin_resolve_report), cohérent avec le reste de l'espace admin.

-- ── 3. Journal d'actions admin ──────────────────────────────────────────
create table if not exists public.admin_actions_log (
  id uuid default uuid_generate_v4() primary key,
  admin_id uuid references public.users(id) not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

alter table public.admin_actions_log enable row level security;
-- Idem : aucune policy client, uniquement via admin_list_actions_log() et
-- les RPC de modération qui y insèrent une ligne.

-- ── get_my_user_data : expose la suspension pour forcer la déconnexion ──
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
    'is_admin', u.is_admin,
    'is_suspended', u.is_suspended,
    'suspended_reason', u.suspended_reason,
    'profile', to_json(p.*)
  )
  into result
  from public.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid();

  return result;
end;
$$;

-- ── Signaler un avis ou un praticien (n'importe quel utilisateur connecté) ──
create or replace function create_report(p_target_type text, p_target_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target_type not in ('review', 'doctor') then
    raise exception 'Type de signalement invalide';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'Le motif du signalement est requis';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason)
  values (auth.uid(), p_target_type, p_target_id, trim(p_reason));
end;
$$;

grant execute on function create_report(text, uuid, text) to authenticated;

-- ── Liste des signalements (admin) ──────────────────────────────────────
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
      -- Aperçu de la cible selon son type : le commentaire de l'avis, ou
      -- le nom/spécialité du praticien — pour afficher le contexte sans
      -- naviguer manuellement vers la fiche.
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
            'specialty', d.specialty
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

grant execute on function admin_list_reports() to authenticated;

-- ── Traiter un signalement (admin) ──────────────────────────────────────
create or replace function admin_resolve_report(p_report_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Statut invalide';
  end if;

  update public.reports set
    status = p_status,
    admin_note = p_note,
    resolved_by = auth.uid(),
    resolved_at = now()
  where id = p_report_id;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'resolve_report', 'report', p_report_id, jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

grant execute on function admin_resolve_report(uuid, text, text) to authenticated;

-- ── Supprimer un avis (admin) ────────────────────────────────────────────
create or replace function admin_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select doctor_id into v_doctor_id from public.reviews where id = p_review_id;
  if v_doctor_id is null then
    raise exception 'Avis introuvable';
  end if;

  delete from public.reviews where id = p_review_id;

  -- trg_update_rating ne couvre que insert/update : recalcul manuel ici.
  update public.doctors set
    average_rating = coalesce((select avg(rating) from public.reviews where doctor_id = v_doctor_id), 0),
    review_count = (select count(*) from public.reviews where doctor_id = v_doctor_id)
  where id = v_doctor_id;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id)
  values (auth.uid(), 'delete_review', 'review', p_review_id);
end;
$$;

grant execute on function admin_delete_review(uuid) to authenticated;

-- ── Suspendre / réactiver un compte (admin) ─────────────────────────────
create or replace function admin_suspend_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Impossible de suspendre son propre compte';
  end if;

  update public.users set
    is_suspended = true,
    suspended_reason = p_reason,
    suspended_at = now()
  where id = p_user_id;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'suspend_user', 'user', p_user_id, jsonb_build_object('reason', p_reason));
end;
$$;

grant execute on function admin_suspend_user(uuid, text) to authenticated;

create or replace function admin_unsuspend_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  update public.users set
    is_suspended = false,
    suspended_reason = null,
    suspended_at = null
  where id = p_user_id;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id)
  values (auth.uid(), 'unsuspend_user', 'user', p_user_id);
end;
$$;

grant execute on function admin_unsuspend_user(uuid) to authenticated;

-- ── Journal d'actions (admin) ────────────────────────────────────────────
create or replace function admin_list_actions_log()
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
      'id', l.id,
      'action', l.action,
      'target_type', l.target_type,
      'target_id', l.target_id,
      'details', l.details,
      'created_at', l.created_at,
      'admin_name', coalesce(ap.first_name || ' ' || ap.last_name, au.email)
    ) order by l.created_at desc)
    from (select * from public.admin_actions_log order by created_at desc limit 300) l
    left join public.users au on au.id = l.admin_id
    left join public.profiles ap on ap.user_id = l.admin_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function admin_list_actions_log() to authenticated;

-- ── admin_platform_stats : ajoute le compteur de signalements en attente ──
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
    'reports_pending', (select count(*) from public.reports where status = 'pending'),
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

-- ── admin_patient_detail / admin_doctor_detail : exposer l'état de suspension ──
-- (admin_doctor_detail redéfinie ici pour ajouter is_suspended ; le reste du
-- corps est identique à la migration 057.)
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

create or replace function admin_patient_detail(p_user_id uuid)
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
    'user_id', u.id,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'email', u.email,
    'phone', p.phone,
    'avatar_url', p.avatar_url,
    'address', p.address,
    'date_of_birth', p.date_of_birth,
    'created_at', u.created_at,
    'is_suspended', u.is_suspended,
    'suspended_reason', u.suspended_reason,
    'animals', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'species', a.species, 'avatar_url', a.avatar_url
      ) order by a.name asc), '[]'::jsonb)
      from public.animals a where a.owner_id = u.id
    ),
    'appointments_total', (select count(*) from public.appointments where patient_id = u.id),
    'appointments_upcoming', (select count(*) from public.appointments where patient_id = u.id and start_at > now() and status in ('pending', 'confirmed')),
    'appointments_completed', (select count(*) from public.appointments where patient_id = u.id and status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments where patient_id = u.id and status = 'cancelled'),
    'reviews_written', (select count(*) from public.reviews where patient_id = u.id)
  )
  into result
  from public.users u
  join public.profiles p on p.user_id = u.id
  where u.id = p_user_id;

  if result is null then
    raise exception 'Propriétaire introuvable';
  end if;

  return result;
end;
$$;

grant execute on function admin_patient_detail(uuid) to authenticated;
