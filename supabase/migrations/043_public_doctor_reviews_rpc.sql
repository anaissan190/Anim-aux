-- ============================================================
-- ANIMÉAUX — Expose le prénom/nom du patient auteur d'un avis
-- Le prénom/nom du patient (public.profiles) est privé par RLS — un
-- visiteur non connecté (ou un autre patient) ne peut pas le lire
-- directement, donc l'embed `profiles!reviews_patient_id_profiles_fkey`
-- utilisé sur la fiche praticien renvoie toujours `null` pour l'auteur
-- de l'avis, même si l'avis lui-même est public.
-- Cette fonction SECURITY DEFINER expose uniquement prénom/nom/avatar
-- (jamais téléphone/adresse/date de naissance), même principe que
-- get_clinic_team / get_doctor_clinic déjà utilisées ailleurs dans
-- ce projet pour contourner le RLS de façon contrôlée.
-- ============================================================

create or replace function public.get_doctor_reviews(p_doctor_id uuid)
returns table (
  id uuid,
  appointment_id uuid,
  doctor_id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  patient_first_name text,
  patient_last_name text,
  patient_avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.appointment_id, r.doctor_id, r.rating, r.comment, r.created_at,
    p.first_name, p.last_name, p.avatar_url
  from reviews r
  left join profiles p on p.user_id = r.patient_id
  where r.doctor_id = p_doctor_id
  order by r.created_at desc
$$;

grant execute on function public.get_doctor_reviews(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
