-- ============================================================
-- Dernières cartes cliquables de la vue d'ensemble admin : Secrétariats
-- et Rendez-vous (à venir / au total)
-- ============================================================

create or replace function admin_list_secretaries()
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
      'created_at', u.created_at,
      'clinic_id', cs.clinic_id,
      'clinic_name', c.name
    ) order by u.created_at desc)
    from public.users u
    join public.profiles p on p.user_id = u.id
    left join public.clinic_staff cs on cs.user_id = u.id
    left join public.clinics c on c.id = cs.clinic_id
    where u.role = 'secretary'
  ), '[]'::jsonb);
end;
$$;

grant execute on function admin_list_secretaries() to authenticated;

-- Plafonné à 500 lignes (les plus récentes) : suffisant pour un usage
-- d'admin analytique, sans exposer un payload illimité à mesure que la
-- plateforme grossit.
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
      'doctor_specialty', d.specialty
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

grant execute on function admin_list_appointments() to authenticated;
