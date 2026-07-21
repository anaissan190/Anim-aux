-- ============================================================
-- Correctif : admin_review_doctor échouait à l'insertion de la notification
-- ============================================================
-- Le résultat d'un CASE WHEN sur des littéraux texte est résolu en type
-- "text" par Postgres, ce qui casse la coercion implicite normalement
-- appliquée aux littéraux directs pour une colonne de type enum
-- (notification_type) — d'où l'erreur "column type is of type
-- notification_type but expression is of type text". Cast explicite.

create or replace function admin_review_doctor(p_doctor_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select user_id into target_user_id from public.doctors where id = p_doctor_id;
  if target_user_id is null then
    raise exception 'Praticien introuvable';
  end if;

  update public.doctors
  set verification_status = case when p_approve then 'verified' else 'rejected' end,
      verification_rejected_reason = case when p_approve then null else p_reason end,
      is_verified = p_approve
  where id = p_doctor_id;

  insert into public.notifications (user_id, type, title, body)
  values (
    target_user_id,
    (case when p_approve then 'doctor_verified' else 'doctor_rejected' end)::notification_type,
    case when p_approve then 'Profil vérifié ✓' else 'Documents non validés' end,
    case when p_approve
      then 'Votre profil praticien a été vérifié. Vous apparaissez désormais dans les résultats de recherche.'
      else coalesce('Vos documents n''ont pas pu être validés : ' || p_reason, 'Vos documents n''ont pas pu être validés. Merci de les redéposer depuis votre tableau de bord.')
    end
  );
end;
$$;
