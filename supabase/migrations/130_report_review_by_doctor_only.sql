-- ============================================================
-- ANIMÉAUX — Seul le praticien concerné peut signaler un avis (12/10/2026)
-- ============================================================
-- create_report (063) laissait n'importe quel utilisateur connecté signaler un
-- avis, et n'importe quel identifiant : le bouton « Signaler » apparaissait sur
-- chaque avis de la fiche publique, côté propriétaire. Le besoin réel : c'est le
-- PRATICIEN visé par un avis abusif qui le signale, depuis l'onglet Avis de son
-- espace.
--
-- Règle côté base (l'écran ne suffit pas) :
--   * 'review' : l'appelant doit être le praticien de cet avis ;
--   * 'doctor' : la cible doit exister, et on ne se signale pas soi-même.
-- Les signalements déjà enregistrés ne sont pas touchés.
-- Retour arrière : recréer create_report depuis la migration 063.
-- ============================================================

create or replace function public.create_report(p_target_type text, p_target_id uuid, p_reason text)
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

  if p_target_type = 'review' then
    if not exists (
      select 1
      from public.reviews r
      join public.doctors d on d.id = r.doctor_id
      where r.id = p_target_id and d.user_id = auth.uid()
    ) then
      raise exception 'Seul le praticien concerné peut signaler cet avis';
    end if;
  else
    if not exists (select 1 from public.doctors d where d.id = p_target_id) then
      raise exception 'Praticien introuvable';
    end if;
    if exists (select 1 from public.doctors d where d.id = p_target_id and d.user_id = auth.uid()) then
      raise exception 'Vous ne pouvez pas vous signaler vous-même';
    end if;
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason)
  values (auth.uid(), p_target_type, p_target_id, trim(p_reason));
end;
$$;

grant execute on function public.create_report(text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
