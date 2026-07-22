-- ============================================================
-- Liste complète des avis pour l'admin (tri/filtre côté client)
-- ============================================================
-- Permet de repérer les avis très négatifs sans avoir à ouvrir le
-- tableau de bord Supabase — cliqué depuis la carte "Avis publiés" de
-- la vue d'ensemble admin.

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

grant execute on function admin_list_reviews() to authenticated;
