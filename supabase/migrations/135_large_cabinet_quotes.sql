-- ============================================================
-- 135 — Cabinets de plus de 5 praticiens : demandes de devis + limite par cabinet
--
-- Au-delà de 5 praticiens, pas de tarif publié : le cabinet remplit un questionnaire
-- (/devis-cabinet), Anaïs reçoit la demande par email et la retrouve dans
-- l'administration, puis envoie son devis elle-même. Quand un devis est accepté, elle
-- relève la limite de CE cabinet depuis l'administration (aujourd'hui le trigger
-- refuse tout sixième praticien).
--
--  1. clinics.max_practitioners : limite propre à un cabinet abonné (NULL = défaut, 5).
--     Modifiable par l'admin seulement (verrou dans prevent_self_clinic_plan_change).
--  2. enforce_clinic_member_limit : utilise cette limite.
--  3. admin_set_clinic_max_practitioners : RPC admin, journalisée.
--  4. quote_requests : les demandes. Écrites UNIQUEMENT par la fonction Edge
--     request-cabinet-quote (service_role : validation, limite de fréquence, emails) ;
--     lisibles par leur auteur et par l'admin ; statut modifiable par l'admin.
--
-- Pour annuler :
--   drop table public.quote_requests;
--   drop function public.admin_set_clinic_max_practitioners(uuid, integer);
--   alter table public.clinics drop column max_practitioners;
--   (puis ré-appliquer enforce_clinic_member_limit et prevent_self_clinic_plan_change
--    de 132 / 127)
-- ============================================================

-- 1. Limite propre à un cabinet
alter table public.clinics
  add column if not exists max_practitioners integer
  check (max_practitioners is null or max_practitioners between 5 and 200);

-- Verrou : un créateur de cabinet ne peut pas se relever lui-même la limite
-- (même principe que la colonne plan, migration 127).
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
      new.max_practitioners := null;
    else
      if new.plan is distinct from old.plan then
        new.plan := old.plan;
      end if;
      if new.max_practitioners is distinct from old.max_practitioners then
        new.max_practitioners := old.max_practitioners;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 2. La limite d'un cabinet abonné : sa valeur propre, sinon 5
create or replace function public.enforce_clinic_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_custom integer;
  v_count integer;
  v_max integer;
begin
  select plan, max_practitioners into v_plan, v_custom from public.clinics where id = new.clinic_id;
  select count(*) into v_count from public.clinic_members where clinic_id = new.clinic_id;
  v_max := case when v_plan = 'cabinet' then coalesce(v_custom, 5) else 1 end;
  if v_count >= v_max then
    if v_plan = 'cabinet' then
      raise exception 'Ce cabinet a déjà ses % praticiens.', v_max;
    else
      raise exception 'Ce cabinet n''est pas encore activé : son créateur doit activer l''abonnement cabinet pour accueillir d''autres praticiens.';
    end if;
  end if;
  return new;
end;
$$;

-- 3. Relever (ou remettre par défaut) la limite d'un cabinet
create or replace function public.admin_set_clinic_max_practitioners(p_clinic_id uuid, p_max integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_max is not null and (p_max < 5 or p_max > 200) then
    raise exception 'La limite doit être comprise entre 5 et 200';
  end if;
  select count(*) into v_count from public.clinic_members where clinic_id = p_clinic_id;
  if p_max is not null and p_max < v_count then
    raise exception 'Ce cabinet a déjà % praticiens : la limite ne peut pas être plus basse.', v_count;
  end if;

  update public.clinics set max_practitioners = p_max where id = p_clinic_id;
  if not found then
    raise exception 'Cabinet introuvable';
  end if;

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'set_clinic_max_practitioners', 'clinic', p_clinic_id, jsonb_build_object('max_practitioners', p_max));
end;
$$;

grant execute on function public.admin_set_clinic_max_practitioners(uuid, integer) to authenticated;

-- 4. Demandes de devis
create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Copie du contact au moment de la demande : l'admin répond sans jointure, et la demande
  -- reste lisible si le praticien change d'adresse ou de nom plus tard.
  requester_name text,
  requester_email text not null,
  clinic_name text not null,
  city text,
  practitioner_count integer not null check (practitioner_count between 1 and 500),
  practitioner_count_next_year integer check (practitioner_count_next_year is null or practitioner_count_next_year between 1 and 500),
  secretary_count integer not null default 0 check (secretary_count between 0 and 200),
  phone text,
  message text,
  status text not null default 'new' check (status in ('new', 'quote_sent', 'accepted', 'declined')),
  admin_note text,
  -- Emails (journal : un échec d'envoi n'empêche jamais l'enregistrement de la demande)
  admin_notified_at timestamptz,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_requests_user_created_idx on public.quote_requests (user_id, created_at desc);
create index if not exists quote_requests_status_idx on public.quote_requests (status, created_at desc);

alter table public.quote_requests enable row level security;

-- Aucune politique d'insertion ni de suppression : seule la fonction Edge (service_role,
-- qui contourne la RLS) écrit une demande.
drop policy if exists "quote_requests: l'auteur et l'admin lisent" on public.quote_requests;
create policy "quote_requests: l'auteur et l'admin lisent" on public.quote_requests
  for select using (is_admin() or user_id = auth.uid());

-- L'admin change le statut et sa note ; WITH CHECK identique pour qu'une mise à jour ne
-- puisse pas sortir de la ligne du périmètre autorisé (voir feedback_rls_update_with_check).
drop policy if exists "quote_requests: l'admin met à jour" on public.quote_requests;
create policy "quote_requests: l'admin met à jour" on public.quote_requests
  for update using (is_admin()) with check (is_admin());

create or replace function public.touch_quote_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quote_requests_touch on public.quote_requests;
create trigger quote_requests_touch
before update on public.quote_requests
for each row execute function public.touch_quote_request();
