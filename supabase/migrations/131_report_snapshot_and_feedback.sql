-- ============================================================
-- ANIMÉAUX — Retour au praticien sur son signalement d'avis (12/10/2026)
-- ============================================================
-- Quand l'admin traite un signalement d'avis, le praticien qui l'a fait reçoit un
-- email avec l'issue et le commentaire de l'admin (fonction Edge
-- send-report-feedback). Deux colonnes y servent :
--   * target_snapshot : copie de l'avis (note, texte, date) prise au moment du
--     signalement — si l'admin supprime l'avis, il n'est plus lisible ensuite et
--     l'email ne pourrait plus le rappeler ;
--   * feedback_sent_at : un seul email par signalement.
-- Les signalements déjà enregistrés n'ont pas de copie : l'email ne rappelle
-- alors l'avis que s'il existe encore.
-- ============================================================

alter table public.reports
  add column if not exists target_snapshot jsonb,
  add column if not exists feedback_sent_at timestamptz;

create or replace function public.create_report(p_target_type text, p_target_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
begin
  if p_target_type not in ('review', 'doctor') then
    raise exception 'Type de signalement invalide';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'Le motif du signalement est requis';
  end if;

  if p_target_type = 'review' then
    if not exists (
      select 1
      from public.reviews r
      join public.doctors d on d.id = r.doctor_id
      where r.id = p_target_id and d.user_id = auth.uid()
    ) then
      raise exception 'Seul le praticien concerné peut signaler cet avis';
    end if;

    select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at)
    into v_snapshot
    from public.reviews r
    where r.id = p_target_id;
  else
    if not exists (select 1 from public.doctors d where d.id = p_target_id) then
      raise exception 'Praticien introuvable';
    end if;
    if exists (select 1 from public.doctors d where d.id = p_target_id and d.user_id = auth.uid()) then
      raise exception 'Vous ne pouvez pas vous signaler vous-même';
    end if;
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, target_snapshot)
  values (auth.uid(), p_target_type, p_target_id, trim(p_reason), v_snapshot);
end;
$$;

grant execute on function public.create_report(text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
