-- ============================================================
-- Profils propriétaires d'animaux pour l'admin (liste + fiche détaillée)
-- ============================================================
-- Symétrique aux dossiers praticiens : la carte "Propriétaires" de la
-- vue d'ensemble admin devient cliquable vers une liste recherchable,
-- et chaque propriétaire ouvre une fiche exhaustive (coordonnées,
-- animaux, statistiques de rendez-vous, avis rédigés).

create or replace function admin_list_patients()
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
      'user_id', u.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', u.email,
      'phone', p.phone,
      'created_at', u.created_at,
      'animals_count', (select count(*) from public.animals a where a.owner_id = u.id),
      'appointments_count', (select count(*) from public.appointments ap where ap.patient_id = u.id)
    ) order by u.created_at desc)
    from public.users u
    join public.profiles p on p.user_id = u.id
    where u.role = 'patient'
  ), '[]'::jsonb);
end;
$$;

grant execute on function admin_list_patients() to authenticated;

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
    'address', p.address,
    'date_of_birth', p.date_of_birth,
    'avatar_url', p.avatar_url,
    'created_at', u.created_at,
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
