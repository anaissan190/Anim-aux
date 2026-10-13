-- ============================================================
-- ANIMÉAUX — Abonnements payants (Stripe) : tables, application de l'état, garde-fous
-- (13/10/2026)
-- ============================================================
-- Stripe est la source de vérité. Les fonctions Edge (create-checkout-session,
-- create-portal-session, stripe-webhook) font le lien ; la base garde :
--   * billing_customers : quel compte correspond à quel client Stripe ;
--   * subscriptions     : copie de l'état de chaque abonnement (statut, fin de période,
--                         résiliation programmée), lisible par son titulaire ;
--   * apply_subscription_state() : seule voie qui modifie doctors.plan / clinics.plan à
--                         partir d'un paiement, réservée au rôle service_role (donc au
--                         webhook signé). Elle passe par le drapeau local
--                         app.internal_plan_update prévu en migration 127 : le verrou
--                         anti auto-attribution reste intact pour tout le monde.
-- Les offres « fondateur » attribuées par un admin (127) n'ont aucune ligne ici : le
-- webhook n'y touche jamais.
--
-- Garde-fous : un abonnement actif (et non résilié) empêche de supprimer son compte
-- ou de fermer son cabinet, pour ne pas laisser un prélèvement courir sur un compte
-- disparu.
--
-- Retour arrière : drop table public.subscriptions, public.billing_customers cascade;
-- drop function public.apply_subscription_state(...) ; puis recréer delete_my_account
-- depuis la migration 103 et supprimer le trigger clinics_prevent_deletion_with_subscription.
-- ============================================================

create table if not exists public.billing_customers (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
-- Aucune policy : table lue/écrite uniquement par les fonctions Edge (service_role).

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('doctor', 'clinic')),
  doctor_id uuid references public.doctors(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'doctor' and doctor_id is not null and clinic_id is null)
    or (kind = 'clinic' and clinic_id is not null and doctor_id is null)
  )
);
create index if not exists idx_subscriptions_doctor on public.subscriptions(doctor_id);
create index if not exists idx_subscriptions_clinic on public.subscriptions(clinic_id);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: le titulaire lit les siennes" on public.subscriptions;
create policy "subscriptions: le titulaire lit les siennes" on public.subscriptions for select using (
  is_admin()
  or (kind = 'doctor' and exists (
    select 1 from public.doctors d where d.id = subscriptions.doctor_id and d.user_id = auth.uid()))
  or (kind = 'clinic' and exists (
    select 1 from public.clinics c where c.id = subscriptions.clinic_id and c.owner_id = auth.uid()))
);
-- Aucune policy d'écriture : seules les fonctions SECURITY DEFINER / le service_role écrivent.

-- Recopie l'état d'un abonnement Stripe et applique l'offre correspondante.
-- Idempotent et tolérant à l'ordre d'arrivée : un événement plus ancien que le
-- dernier appliqué est ignoré. L'accès dépend de TOUS les abonnements de la cible :
-- la fin d'un ancien abonnement ne retire pas l'accès à un nouveau.
create or replace function public.apply_subscription_state(
  p_kind text,
  p_target_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_paid boolean;
  v_plan text;
begin
  if p_kind not in ('doctor', 'clinic') then
    raise exception 'Type d''abonnement invalide';
  end if;

  -- Cible disparue (compte supprimé depuis) : rien à appliquer, pas d'erreur
  -- (sinon Stripe renverrait l'événement en boucle).
  if p_kind = 'doctor' and not exists (select 1 from public.doctors where id = p_target_id) then
    return 'ignored_missing_target';
  end if;
  if p_kind = 'clinic' and not exists (select 1 from public.clinics where id = p_target_id) then
    return 'ignored_missing_target';
  end if;

  select last_event_at into v_last from public.subscriptions where stripe_subscription_id = p_subscription_id;
  if v_last is not null and p_event_at < v_last then
    return 'ignored_old_event';
  end if;

  insert into public.subscriptions (
    kind, doctor_id, clinic_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
    status, current_period_end, cancel_at_period_end, last_event_at
  ) values (
    p_kind,
    case when p_kind = 'doctor' then p_target_id end,
    case when p_kind = 'clinic' then p_target_id end,
    p_customer_id, p_subscription_id, p_price_id,
    p_status, p_period_end, coalesce(p_cancel_at_period_end, false), p_event_at
  )
  on conflict (stripe_subscription_id) do update set
    stripe_price_id = excluded.stripe_price_id,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_event_at = excluded.last_event_at,
    updated_at = now();

  perform set_config('app.internal_plan_update', 'on', true);

  if p_kind = 'doctor' then
    v_paid := exists (
      select 1 from public.subscriptions s
      where s.doctor_id = p_target_id and s.status in ('active', 'trialing', 'past_due'));
    v_plan := case when v_paid then 'pro' else 'free' end;
    update public.doctors set plan = v_plan where id = p_target_id;
  else
    v_paid := exists (
      select 1 from public.subscriptions s
      where s.clinic_id = p_target_id and s.status in ('active', 'trialing', 'past_due'));
    v_plan := case when v_paid then 'cabinet' else 'free' end;
    update public.clinics set plan = v_plan where id = p_target_id;
  end if;

  return v_plan;
end;
$$;

revoke all on function public.apply_subscription_state(text, uuid, text, text, text, text, timestamptz, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_state(text, uuid, text, text, text, text, timestamptz, boolean, timestamptz)
  to service_role;

-- Un abonnement en cours (non résilié) empêche de supprimer son compte.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doctor_id uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  select id into v_doctor_id from doctors where user_id = v_uid;

  if exists (
    select 1 from subscriptions s
    where s.status in ('active', 'trialing', 'past_due')
      and not s.cancel_at_period_end
      and (
        (v_doctor_id is not null and s.doctor_id = v_doctor_id)
        or s.clinic_id in (select id from clinics where owner_id = v_uid)
      )
  ) then
    raise exception 'Vous avez un abonnement en cours : résiliez-le d''abord depuis « Mon abonnement », puis supprimez votre compte.';
  end if;

  delete from clinic_services where clinic_id in (select id from clinics where owner_id = v_uid);
  delete from clinic_members  where clinic_id in (select id from clinics where owner_id = v_uid);
  delete from clinics where owner_id = v_uid;

  if v_doctor_id is not null then
    delete from clinic_members where doctor_id = v_doctor_id;
  end if;

  delete from care_items      where animal_id in (select id from animals where owner_id = v_uid);
  delete from weight_tracking where animal_id in (select id from animals where owner_id = v_uid);
  delete from health_records  where animal_id in (select id from animals where owner_id = v_uid);
  delete from animals where owner_id = v_uid;

  delete from appointments where patient_id = v_uid or doctor_id = v_doctor_id;

  if v_doctor_id is not null then
    delete from blocked_slots  where doctor_id = v_doctor_id;
    delete from availabilities where doctor_id = v_doctor_id;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- Même garde-fou pour la fermeture d'un cabinet abonné.
create or replace function public.prevent_clinic_deletion_with_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.subscriptions s
    where s.clinic_id = old.id
      and s.status in ('active', 'trialing', 'past_due')
      and not s.cancel_at_period_end
  ) then
    raise exception 'Ce cabinet a un abonnement en cours : résiliez-le d''abord depuis « Mon abonnement », puis fermez le cabinet.';
  end if;
  return old;
end;
$$;

drop trigger if exists clinics_prevent_deletion_with_subscription on public.clinics;
create trigger clinics_prevent_deletion_with_subscription
before delete on public.clinics
for each row execute function public.prevent_clinic_deletion_with_subscription();

notify pgrst, 'reload schema';
