-- ============================================================
-- Dossiers cabinets pour l'admin (liste + fiche détaillée)
-- ============================================================
-- Troisième et dernier type de profil consultable depuis l'espace admin,
-- avec les praticiens (migrations 051/056/057) et les propriétaires
-- (migration 059) : la carte "Cabinets" de la vue d'ensemble devient
-- cliquable vers une liste, chaque cabinet ouvrant une fiche détaillée
-- (propriétaire, praticiens membres, secrétariat, activité).

create or replace function admin_list_clinics()
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
      'clinic_id', c.id,
      'name', c.name,
      'city', c.city,
      'address', c.address,
      'phone', c.phone,
      'logo_url', c.logo_url,
      'owner_id', c.owner_id,
      'owner_name', coalesce(op.first_name || ' ' || op.last_name, ''),
      'owner_email', ou.email,
      'members_count', (select count(*) from public.clinic_members cm where cm.clinic_id = c.id),
      'secretaries_count', (select count(*) from public.clinic_staff cs where cs.clinic_id = c.id)
    ) order by c.name asc)
    from public.clinics c
    left join public.profiles op on op.user_id = c.owner_id
    left join public.users ou on ou.id = c.owner_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function admin_list_clinics() to authenticated;

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
        'specialty', d.specialty,
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

grant execute on function admin_clinic_detail(uuid) to authenticated;
