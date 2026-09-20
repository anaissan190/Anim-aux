-- ============================================================
-- Crash confirmé le 20/09/2026 via un enregistrement d'écran mobile
-- (page blanche "Une erreur est survenue", Sentry) : update_doctor_rating()
-- (trigger déclenché à chaque avis posté/modifié/supprimé, voir 079)
-- recalcule average_rating avec `avg(rating)` sans coalesce — si le
-- dernier avis d'un praticien est supprimé (ou s'il n'en a jamais eu),
-- avg() sur zéro ligne renvoie NULL, pas 0, et la colonne devient NULL en
-- base. Toute carte praticien appelle ensuite `average_rating.toFixed(1)`
-- sans garde (DoctorCard.tsx, ClinicCard.tsx, DoctorPage.tsx) — un crash
-- JS qui fait tomber toute l'app dans l'ErrorBoundary, pas juste un
-- affichage cassé. Corrigé aux deux niveaux : le trigger (pour l'avenir)
-- et un backfill (pour les lignes déjà NULL en prod).
-- ============================================================

create or replace function update_doctor_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal_rating_update', 'on', true);
  update public.doctors set
    average_rating = coalesce((select avg(rating) from public.reviews where doctor_id = NEW.doctor_id), 0),
    review_count   = coalesce((select count(*) from public.reviews where doctor_id = NEW.doctor_id), 0)
  where id = NEW.doctor_id;
  return NEW;
end;
$$;

update public.doctors set average_rating = 0 where average_rating is null;
