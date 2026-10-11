-- ============================================================
-- ANIMÉAUX — Offre du praticien : gratuite ou abonnement (11/10/2026)
-- ============================================================
-- ÉTAPE 1 sur plusieurs : seulement le champ et son contrôle. Rien ne change
-- encore pour les utilisateurs — les restrictions de l'offre gratuite
-- (réservation, messagerie…) viendront dans les étapes suivantes.
--
--   plan = 'free' : fiche visible dans la recherche, sans les autres
--                   fonctionnalités ;
--   plan = 'pro'  : abonnement, toutes les fonctionnalités.
--
-- Les praticiens EXISTANTS passent en 'pro' (offre « fondateur » offerte) ;
-- tout nouveau praticien démarre en 'free'. Le changement d'offre est
-- verrouillé comme verification_status (migration 079) : un praticien ne peut
-- pas se l'attribuer lui-même, ni à l'inscription ni ensuite. Seuls peuvent
-- le modifier : un admin (RPC admin_set_doctor_plan ci-dessous) et, plus tard,
-- le webhook de paiement — via le drapeau local à la transaction
-- app.internal_plan_update, comme app.internal_rating_update.
-- ============================================================

-- Idempotent : la valeur 'pro' des praticiens existants n'est posée qu'à la
-- création de la colonne, jamais lors d'une réexécution.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'doctors' and column_name = 'plan'
  ) then
    alter table public.doctors
      add column plan text not null default 'pro'
      check (plan in ('free', 'pro'));
    alter table public.doctors alter column plan set default 'free';
  end if;
end $$;

create or replace function public.prevent_self_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin()
     and coalesce(current_setting('app.internal_plan_update', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.plan := 'free';
    elsif new.plan is distinct from old.plan then
      new.plan := old.plan;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists doctors_prevent_self_plan_change on public.doctors;
create trigger doctors_prevent_self_plan_change
before insert or update on public.doctors
for each row execute function public.prevent_self_plan_change();

create or replace function public.admin_set_doctor_plan(p_doctor_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_plan not in ('free', 'pro') then
    raise exception 'Offre inconnue';
  end if;

  update public.doctors set plan = p_plan where id = p_doctor_id;
  if not found then
    raise exception 'Praticien introuvable';
  end if;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'set_doctor_plan', 'doctor', p_doctor_id, jsonb_build_object('plan', p_plan));
end;
$$;

grant execute on function public.admin_set_doctor_plan(uuid, text) to authenticated;

notify pgrst, 'reload schema';
