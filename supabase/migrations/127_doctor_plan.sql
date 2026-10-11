-- ============================================================
-- ANIMÉAUX — Offres : praticien (gratuite / abonnement) et cabinet (11/10/2026)
-- ============================================================
-- ÉTAPE 1 sur plusieurs : seulement le champ et son contrôle. Rien ne change
-- encore pour les utilisateurs — les restrictions de l'offre gratuite
-- (réservation, messagerie…) viendront dans les étapes suivantes.
--
--   doctors.plan = 'free' : fiche visible dans la recherche, sans les autres
--                           fonctionnalités ;
--   doctors.plan = 'pro'  : abonnement individuel, toutes les fonctionnalités ;
--   clinics.plan = 'free'    : cabinet non activé (1 seul membre : son créateur) ;
--   clinics.plan = 'cabinet' : abonnement cabinet, jusqu'à 5 praticiens, qui
--                              ont toutes les fonctionnalités tant qu'ils en sont
--                              membres (les secrétariats ne comptent pas).
--
-- Un praticien a donc toutes les fonctionnalités s'il est abonné lui-même OU
-- membre d'un cabinet abonné : fonction doctor_has_pro().
--
-- Les praticiens et les cabinets EXISTANTS passent en abonnement (offre
-- « fondateur » offerte) ; tout nouveau praticien / cabinet démarre en
-- 'free'. Le changement d'offre est verrouillé comme verification_status
-- (migration 079) : ni un praticien ni un propriétaire de cabinet ne peut se
-- l'attribuer, ni à la création ni ensuite. Seuls peuvent le modifier : un
-- admin (RPC admin_set_doctor_plan / admin_set_clinic_plan ci-dessous) et, plus
-- tard, le webhook de paiement — via le drapeau local à la transaction
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

-- ── Cabinets ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinics' and column_name = 'plan'
  ) then
    alter table public.clinics
      add column plan text not null default 'cabinet'
      check (plan in ('free', 'cabinet'));
    alter table public.clinics alter column plan set default 'free';
  end if;
end $$;

create or replace function public.prevent_self_clinic_plan_change()
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

drop trigger if exists clinics_prevent_self_plan_change on public.clinics;
create trigger clinics_prevent_self_plan_change
before insert or update on public.clinics
for each row execute function public.prevent_self_clinic_plan_change();

create or replace function public.admin_set_clinic_plan(p_clinic_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_plan not in ('free', 'cabinet') then
    raise exception 'Offre inconnue';
  end if;

  update public.clinics set plan = p_plan where id = p_clinic_id;
  if not found then
    raise exception 'Cabinet introuvable';
  end if;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'set_clinic_plan', 'clinic', p_clinic_id, jsonb_build_object('plan', p_plan));
end;
$$;

grant execute on function public.admin_set_clinic_plan(uuid, text) to authenticated;

-- Nombre maximum de praticiens : 5 pour un cabinet abonné, 1 (son créateur)
-- pour un cabinet non activé. Ne bloque que les NOUVEAUX membres : un cabinet
-- existant qui dépasserait déjà 5 n'est pas touché. Les secrétariats ne sont
-- pas dans clinic_members (table clinic_staff), donc ne comptent pas.
create or replace function public.enforce_clinic_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select plan into v_plan from public.clinics where id = new.clinic_id;
  select count(*) into v_count from public.clinic_members where clinic_id = new.clinic_id;
  v_max := case when v_plan = 'cabinet' then 5 else 1 end;
  if v_count >= v_max then
    raise exception 'Ce cabinet a atteint son nombre maximum de praticiens (%).', v_max;
  end if;
  return new;
end;
$$;

drop trigger if exists clinic_members_enforce_limit on public.clinic_members;
create trigger clinic_members_enforce_limit
before insert on public.clinic_members
for each row execute function public.enforce_clinic_member_limit();

-- Toutes les fonctionnalités : abonnement individuel OU membre d'un cabinet
-- abonné. SECURITY DEFINER pour ne pas passer par les policies RLS de
-- clinic_members/clinics (boucles de récursion RLS déjà rencontrées, voir
-- migrations 040/041/095/097).
create or replace function public.doctor_has_pro(p_doctor_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((select d.plan = 'pro' from public.doctors d where d.id = p_doctor_id), false)
    or exists (
      select 1
      from public.clinic_members cm
      join public.clinics c on c.id = cm.clinic_id
      where cm.doctor_id = p_doctor_id and c.plan = 'cabinet'
    );
$$;

grant execute on function public.doctor_has_pro(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
