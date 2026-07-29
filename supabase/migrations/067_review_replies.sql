-- ============================================================
-- ANIMÉAUX — Réponse du praticien à un avis
-- Sur le modèle de Doctolib : un praticien peut répondre publiquement
-- à un avis laissé sur sa fiche. La réponse est stockée sur la ligne
-- reviews elle-même (doctor_reply / doctor_reply_at) plutôt que dans
-- une table séparée, une seule réponse par avis étant nécessaire.
--
-- Protection : on ne peut pas se contenter d'une policy RLS "update"
-- classique, qui autoriserait le praticien à modifier rating/comment
-- (propriété du patient), pas seulement sa réponse. La fonction
-- reply_to_review() est SECURITY DEFINER et ne touche jamais qu'aux
-- deux colonnes doctor_reply/doctor_reply_at, après avoir vérifié que
-- l'appelant est bien le praticien concerné par l'avis.
-- ============================================================

alter table public.reviews add column if not exists doctor_reply text;
alter table public.reviews add column if not exists doctor_reply_at timestamptz;

create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
begin
  select id into v_doctor_id from public.doctors where user_id = auth.uid();
  if v_doctor_id is null then
    raise exception 'Seul un praticien peut répondre à un avis.';
  end if;

  if not exists (select 1 from public.reviews where id = p_review_id and doctor_id = v_doctor_id) then
    raise exception 'Avis introuvable ou non associé à ce praticien.';
  end if;

  update public.reviews
  set
    doctor_reply = nullif(trim(p_reply), ''),
    doctor_reply_at = case when nullif(trim(p_reply), '') is null then null else now() end
  where id = p_review_id;
end;
$$;

grant execute on function public.reply_to_review(uuid, text) to authenticated;

-- get_doctor_reviews (043) doit désormais renvoyer la réponse.
create or replace function public.get_doctor_reviews(p_doctor_id uuid)
returns table (
  id uuid,
  appointment_id uuid,
  doctor_id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  doctor_reply text,
  doctor_reply_at timestamptz,
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
    r.doctor_reply, r.doctor_reply_at,
    p.first_name, p.last_name, p.avatar_url
  from reviews r
  left join profiles p on p.user_id = r.patient_id
  where r.doctor_id = p_doctor_id
  order by r.created_at desc
$$;

grant execute on function public.get_doctor_reviews(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
