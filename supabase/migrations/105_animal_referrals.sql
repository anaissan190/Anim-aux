-- ============================================================
-- ANIMÉAUX — Partage de dossier animal entre praticiens, avec
-- consentement du propriétaire (23/09/2026)
-- ============================================================
-- Un praticien qui a un accès légitime à l'animal d'un patient (RDV ou
-- même cabinet) peut proposer de transmettre son dossier à un confrère —
-- ex: un vétérinaire recommande un comportementaliste et lui envoie
-- directement l'historique, pour que le propriétaire n'ait pas à tout
-- réexpliquer au premier rendez-vous. Le propriétaire doit explicitement
-- accepter avant que le confrère n'ait le moindre accès (demande
-- explicite d'Anaïs — jamais une décision entre praticiens seuls).
--
-- Une seule table fait office de demande ET de droit d'accès : le statut
-- 'accepted' EST le droit d'accès (voir migration 106, qui l'exploite
-- dans de nouvelles policies read-only), pas besoin d'une table séparée
-- à synchroniser.
-- ============================================================

create table public.animal_referrals (
  id uuid default uuid_generate_v4() primary key,
  animal_id uuid references public.animals(id) on delete cascade not null,
  owner_id uuid references public.users(id) on delete cascade not null,
  referring_doctor_id uuid references public.doctors(id) on delete cascade not null,
  target_doctor_id uuid references public.doctors(id) on delete cascade not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  check (referring_doctor_id <> target_doctor_id)
);

create index idx_animal_referrals_animal on public.animal_referrals(animal_id);
create index idx_animal_referrals_target on public.animal_referrals(target_doctor_id);
create index idx_animal_referrals_owner on public.animal_referrals(owner_id);

-- Empêche d'envoyer deux demandes en attente au même confrère pour le
-- même animal.
create unique index idx_animal_referrals_unique_pending
  on public.animal_referrals(animal_id, target_doctor_id) where (status = 'pending');

alter table public.animal_referrals enable row level security;

-- ── owner_id dérivé côté serveur, jamais fait confiance au client ──────
create or replace function public.set_animal_referral_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select owner_id into new.owner_id from public.animals where id = new.animal_id;
  return new;
end;
$$;

create trigger animal_referrals_set_owner
before insert on public.animal_referrals
for each row execute function public.set_animal_referral_owner();

-- ── Verrouillage des colonnes + des transitions de statut légitimes ────
-- Même idiome que prevent_animal_record_reassignment (081) : RLS filtre
-- les LIGNES visibles/modifiables, jamais quelles COLONNES changent dans
-- un même UPDATE, ni quelle transition précise est légale.
create or replace function public.prevent_animal_referral_tampering()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.animal_id is distinct from old.animal_id
     or new.owner_id is distinct from old.owner_id
     or new.referring_doctor_id is distinct from old.referring_doctor_id
     or new.target_doctor_id is distinct from old.target_doctor_id
     or new.reason is distinct from old.reason
     or new.created_at is distinct from old.created_at then
    new.animal_id := old.animal_id;
    new.owner_id := old.owner_id;
    new.referring_doctor_id := old.referring_doctor_id;
    new.target_doctor_id := old.target_doctor_id;
    new.reason := old.reason;
    new.created_at := old.created_at;
  end if;

  -- Seules transitions légitimes : pending -> accepted/declined,
  -- accepted -> revoked (le propriétaire change d'avis après coup).
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined'))
      or (old.status = 'accepted' and new.status = 'revoked')
    ) then
      new.status := old.status;
    else
      new.responded_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger animal_referrals_prevent_tampering
before update on public.animal_referrals
for each row execute function public.prevent_animal_referral_tampering();

-- ── INSERT : le médecin référent doit déjà avoir un accès légitime à cet
--    animal (RDV en solo ou via son cabinet) — même exists() que les
--    policies équivalentes sur care_items (100/101) ─────────────────────
create policy "animal_referrals: médecin envoie une demande" on public.animal_referrals
for insert with check (
  referring_doctor_id = (select id from public.doctors where user_id = auth.uid())
  and (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = animal_referrals.animal_id
        and a.doctor_id = referring_doctor_id
        and a.status in ('confirmed', 'completed')
    )
    or exists (
      select 1
      from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
      join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
      where an.id = animal_referrals.animal_id
        and cm_moi.doctor_id = referring_doctor_id
    )
  )
);

-- ── UPDATE : seul le propriétaire répond (accepte/refuse/révoque) ──────
create policy "animal_referrals: propriétaire répond" on public.animal_referrals
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- ── SELECT : chacun voit son propre côté ────────────────────────────────
create policy "animal_referrals: propriétaire voit les siennes" on public.animal_referrals
for select using (owner_id = auth.uid());

create policy "animal_referrals: médecin référent voit ses envois" on public.animal_referrals
for select using (referring_doctor_id = (select id from public.doctors where user_id = auth.uid()));

create policy "animal_referrals: médecin destinataire voit ce qu'il reçoit" on public.animal_referrals
for select using (target_doctor_id = (select id from public.doctors where user_id = auth.uid()));

-- ── Notifications (jamais insérées côté client — voir les triggers
--    notify_* déjà en place cette nuit) ─────────────────────────────────
alter type notification_type add value if not exists 'referral_requested';
alter type notification_type add value if not exists 'referral_accepted';
alter type notification_type add value if not exists 'referral_declined';
alter type notification_type add value if not exists 'referral_revoked';

create or replace function public.notify_referral_requested()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  referring_name text;
  target_name text;
begin
  select p.first_name || ' ' || p.last_name into referring_name
  from public.doctors d join public.profiles p on p.user_id = d.user_id
  where d.id = new.referring_doctor_id;

  select p.first_name || ' ' || p.last_name into target_name
  from public.doctors d join public.profiles p on p.user_id = d.user_id
  where d.id = new.target_doctor_id;

  insert into public.notifications (user_id, type, title, body, related_id)
  values (
    new.owner_id,
    'referral_requested',
    'Un médecin souhaite partager un dossier',
    coalesce(referring_name, 'Un praticien') || ' souhaite transmettre le dossier de santé à '
      || coalesce(target_name, 'un confrère') || coalesce(' : ' || new.reason, '') || '. Votre accord est nécessaire.',
    new.animal_id
  );
  return new;
end;
$$;

create trigger trg_notify_referral_requested
after insert on public.animal_referrals
for each row execute function public.notify_referral_requested();

create or replace function public.notify_referral_response()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  referring_user_id uuid;
  owner_name text;
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'declined', 'revoked') then
    select user_id into referring_user_id from public.doctors where id = new.referring_doctor_id;
    select p.first_name || ' ' || p.last_name into owner_name from public.profiles p where p.user_id = new.owner_id;

    insert into public.notifications (user_id, type, title, body, related_id)
    values (
      referring_user_id,
      case new.status
        when 'accepted' then 'referral_accepted'
        when 'declined' then 'referral_declined'
        else 'referral_revoked'
      end,
      case new.status
        when 'accepted' then 'Partage accepté'
        when 'declined' then 'Partage refusé'
        else 'Accès révoqué'
      end,
      coalesce(owner_name, 'Le propriétaire') || case new.status
        when 'accepted' then ' a accepté le partage du dossier.'
        when 'declined' then ' a refusé le partage du dossier.'
        else ' a révoqué l''accès au dossier précédemment partagé.'
      end,
      new.animal_id
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_referral_response
after update on public.animal_referrals
for each row execute function public.notify_referral_response();

notify pgrst, 'reload schema';
