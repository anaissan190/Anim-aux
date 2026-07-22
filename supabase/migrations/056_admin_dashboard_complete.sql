-- ============================================================
-- Espace admin complet : vue d'ensemble + dossier praticien
-- ============================================================
-- Jusqu'ici, le tableau de bord admin ne listait que les praticiens en
-- attente de vérification (admin_list_pending_doctors). Ajoute : (1) des
-- statistiques générales de la plateforme, (2) une consultation du
-- dossier complet (profil + documents) de n'importe quel praticien, quel
-- que soit son statut de vérification — utile pour retrouver les
-- documents d'un praticien déjà validé, ou revoir un dossier rejeté.

create or replace function admin_platform_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when not is_admin() then '{}'::jsonb else jsonb_build_object(
    'patients_count', (select count(*) from public.users where role = 'patient'),
    'doctors_count', (select count(*) from public.doctors),
    'doctors_pending', (select count(*) from public.doctors where verification_status = 'pending'),
    'doctors_verified', (select count(*) from public.doctors where verification_status = 'verified'),
    'doctors_rejected', (select count(*) from public.doctors where verification_status = 'rejected'),
    'secretaries_count', (select count(*) from public.users where role = 'secretary'),
    'clinics_count', (select count(*) from public.clinics),
    'appointments_total', (select count(*) from public.appointments),
    'appointments_upcoming', (select count(*) from public.appointments where start_at > now() and status in ('pending', 'confirmed')),
    'reviews_count', (select count(*) from public.reviews)
  ) end;
$$;

grant execute on function admin_platform_stats() to authenticated;

-- Dossier complet d'un praticien (profil + documents), quel que soit son
-- statut — contrairement à admin_list_pending_doctors, pas restreint aux
-- dossiers en attente.
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
      'specialty', d.specialty,
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

grant execute on function admin_list_doctors_by_status(text) to authenticated;
