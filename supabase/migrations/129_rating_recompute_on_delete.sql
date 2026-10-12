-- ============================================================
-- ANIMÉAUX — La note d'un praticien se recalcule aussi à la suppression d'un
-- avis (12/10/2026)
-- ============================================================
-- Constaté le 12/10/2026 : la fiche de Gary affichait « 4,3 (4 avis) » alors
-- que 2 avis seulement existaient. Le trigger trg_update_rating (039) n'était
-- posé que sur INSERT et UPDATE : quand un compte (de test, ou un vrai
-- utilisateur qui supprime son compte) disparaissait, ses avis partaient en
-- cascade et la note / le nombre d'avis du praticien restaient figés. Seule la
-- suppression par un admin (admin_delete_review, 063) recalculait à la main.
-- Le commentaire de 093 disait « posté/modifié/supprimé » : c'était inexact.
--
-- Correctif : le trigger écoute aussi DELETE, puis on recalcule une fois toutes
-- les notes à partir des avis réellement présents.
-- ============================================================

create or replace function public.update_doctor_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
begin
  v_doctor_id := case when tg_op = 'DELETE' then old.doctor_id else new.doctor_id end;

  perform set_config('app.internal_rating_update', 'on', true);
  update public.doctors set
    average_rating = coalesce((select avg(rating) from public.reviews where doctor_id = v_doctor_id), 0),
    review_count   = coalesce((select count(*) from public.reviews where doctor_id = v_doctor_id), 0)
  where id = v_doctor_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_update_rating on public.reviews;
create trigger trg_update_rating
after insert or update or delete on public.reviews
for each row execute function public.update_doctor_rating();

-- Remise à niveau des notes déjà faussées. Le drapeau est nécessaire : sans lui,
-- prevent_self_verification (079) annule en silence toute écriture de
-- average_rating / review_count hors admin connecté.
select set_config('app.internal_rating_update', 'on', true);
update public.doctors d set
  average_rating = coalesce((select avg(r.rating) from public.reviews r where r.doctor_id = d.id), 0),
  review_count   = coalesce((select count(*) from public.reviews r where r.doctor_id = d.id), 0);

notify pgrst, 'reload schema';
