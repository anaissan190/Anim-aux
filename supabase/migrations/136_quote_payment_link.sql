-- ============================================================
-- 136 — Paiement d'un devis « grand cabinet » (plus de 5 praticiens)
--
-- Une fois le prix du devis fixé, l'admin crée un lien (/paiement-devis/<jeton>) qu'elle
-- joint à son email. Quand le cabinet l'ouvre, la fonction Edge create-quote-checkout crée
-- à ce moment-là la page de paiement Stripe au prix du devis (un abonnement mensuel dont
-- les métadonnées portent le cabinet, la limite de praticiens et la demande). Le webhook
-- active ensuite le cabinet avec SA limite de praticiens et marque la demande « acceptée ».
--
--  1. quote_requests : offre (prix, limite), jeton du lien, dates de suivi.
--  2. admin_prepare_quote_payment / admin_clear_quote_payment : créent / coupent le lien.
--  3. apply_subscription_state : accepte la limite de praticiens du devis
--     (p_max_practitioners) ; sans elle, une limite relevée à la main n'est pas touchée ;
--     abonnement terminé = limite remise par défaut. L'ancienne signature est supprimée
--     pour éviter une ambiguïté entre deux versions de la fonction.
--
-- Pour annuler :
--   alter table public.quote_requests drop column offer_price_cents, drop column offer_max_practitioners,
--     drop column payment_token, drop column payment_prepared_at, drop column offer_clinic_id,
--     drop column checkout_started_at, drop column paid_at;
--   drop function public.admin_prepare_quote_payment(uuid, integer, integer);
--   drop function public.admin_clear_quote_payment(uuid);
--   puis recréer apply_subscription_state depuis la migration 134.
-- ============================================================

-- 1. Offre et lien de paiement sur la demande
alter table public.quote_requests
  add column if not exists offer_price_cents integer
    check (offer_price_cents is null or offer_price_cents between 1000 and 1000000),
  add column if not exists offer_max_practitioners integer
    check (offer_max_practitioners is null or offer_max_practitioners between 6 and 200),
  add column if not exists payment_token text unique,
  add column if not exists payment_prepared_at timestamptz,
  add column if not exists offer_clinic_id uuid references public.clinics(id) on delete set null,
  add column if not exists checkout_started_at timestamptz,
  add column if not exists paid_at timestamptz;

-- 2. Créer (ou mettre à jour) le lien de paiement d'une demande
create or replace function public.admin_prepare_quote_payment(p_quote_id uuid, p_max integer, p_price_cents integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_paid timestamptz;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_max is null or p_max < 6 or p_max > 200 then
    raise exception 'Le nombre de praticiens doit être compris entre 6 et 200';
  end if;
  if p_price_cents is null or p_price_cents < 1000 or p_price_cents > 1000000 then
    raise exception 'Le prix mensuel doit être compris entre 10 et 10 000 € HT';
  end if;

  select payment_token, paid_at into v_token, v_paid
  from public.quote_requests where id = p_quote_id for update;
  if not found then
    raise exception 'Demande introuvable';
  end if;
  if v_paid is not null then
    raise exception 'Cette demande est déjà payée';
  end if;

  -- Le jeton reste le même tant que le lien existe : si le prix est corrigé après l'envoi du
  -- devis, le lien déjà envoyé réclame le nouveau prix.
  if v_token is null then
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  end if;

  update public.quote_requests set
    offer_price_cents = p_price_cents,
    offer_max_practitioners = p_max,
    payment_token = v_token,
    payment_prepared_at = coalesce(payment_prepared_at, now()),
    status = case when status = 'new' then 'quote_sent' else status end
  where id = p_quote_id;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'prepare_quote_payment', 'quote_request', p_quote_id,
          jsonb_build_object('max_practitioners', p_max, 'price_cents', p_price_cents));

  return v_token;
end;
$$;

grant execute on function public.admin_prepare_quote_payment(uuid, integer, integer) to authenticated;

-- Couper le lien (le cabinet ne peut plus payer avec). L'offre enregistrée est conservée.
create or replace function public.admin_clear_quote_payment(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  update public.quote_requests set payment_token = null where id = p_quote_id;
  if not found then
    raise exception 'Demande introuvable';
  end if;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'clear_quote_payment', 'quote_request', p_quote_id, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_clear_quote_payment(uuid) to authenticated;

-- 3. apply_subscription_state : limite de praticiens portée par l'abonnement
drop function if exists public.apply_subscription_state(text, uuid, text, text, text, text, timestamptz, boolean, timestamptz);

create or replace function public.apply_subscription_state(
  p_kind text,
  p_target_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_at timestamptz,
  p_max_practitioners integer default null
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
    -- Limite de praticiens : celle du devis si l'abonnement en porte une (valeur hors
    -- 5–200 ignorée plutôt que de faire échouer l'événement), sinon celle déjà en place ;
    -- plus d'abonnement = retour à la limite par défaut.
    update public.clinics set
      plan = v_plan,
      max_practitioners = case
        when not v_paid then null
        when p_max_practitioners between 5 and 200 then p_max_practitioners
        else max_practitioners
      end
    where id = p_target_id;
  end if;

  return v_plan;
end;
$$;

revoke all on function public.apply_subscription_state(text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_state(text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, integer)
  to service_role;
