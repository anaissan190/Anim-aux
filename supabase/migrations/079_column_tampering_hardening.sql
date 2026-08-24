-- ============================================================
-- Durcissement RLS : plusieurs policies "for update" n'ont qu'une clause
-- USING (ou une clause WITH CHECK qui ne contraint qu'une partie des
-- colonnes) — Postgres/RLS ne protège qu'au niveau de la LIGNE, jamais
-- colonne par colonne. Un appelant autorisé à modifier UNE colonne de sa
-- propre ligne (statut de RDV, is_read...) peut donc, dans le même appel,
-- réécrire n'importe quelle autre colonne de cette même ligne.
--
-- Repéré lors de la recherche de bugs du 24/08/2026 :
--  1. "appointments: médecin peut modifier" / "...patient peut annuler le
--     sien" : aucune des deux ne verrouille patient_id/doctor_id, un
--     médecin ou un patient peut donc réassigner un RDV existant à un
--     autre patient/praticien.
--  2. "doctors: modifier son propre profil" : verification_status était
--     déjà verrouillé (051, prevent_self_verification), mais pas
--     is_verified/average_rating/review_count — modifiables en direct par
--     le praticien lui-même via un simple update de son profil.
--  3. "messages: marquer lu" : un destinataire peut réécrire le contenu,
--     l'expéditeur ou le RDV lié d'un message existant.
--  4. "notifications: marquer lue" : un utilisateur peut réécrire le
--     titre/corps/type/cible d'une notification existante.
--
-- Pattern retenu (déjà utilisé par prevent_self_verification, 051) :
-- trigger BEFORE UPDATE qui remet la colonne protégée à sa valeur OLD si
-- elle a changé et que l'appelant n'est pas admin — plus robuste qu'un
-- WITH CHECK, qui devrait sinon lister explicitement chaque combinaison
-- de colonnes autorisées à changer ensemble.
-- ============================================================

-- ── 1. appointments : patient_id / doctor_id immuables (hors admin) ─────
create or replace function prevent_appointment_identity_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.patient_id is distinct from old.patient_id
      or new.doctor_id is distinct from old.doctor_id)
     and not is_admin() then
    new.patient_id := old.patient_id;
    new.doctor_id := old.doctor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_prevent_identity_tampering on public.appointments;
create trigger appointments_prevent_identity_tampering
before update on public.appointments
for each row execute function prevent_appointment_identity_tampering();

-- ── 2. doctors : is_verified / average_rating / review_count ────────────
-- average_rating et review_count sont légitimement réécrits par
-- update_doctor_rating() (trigger trg_update_rating, déclenché par un
-- patient qui poste/modifie un avis, donc jamais un appel admin) : on lui
-- ajoute un drapeau de contournement local à la transaction, distinct de
-- is_admin(), plutôt que d'exempter ces deux colonnes de toute protection.
create or replace function prevent_self_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.verification_rejected_reason is distinct from old.verification_rejected_reason)
     and not is_admin() then
    new.verification_status := old.verification_status;
    new.verification_rejected_reason := old.verification_rejected_reason;
  end if;

  if (new.is_verified is distinct from old.is_verified)
     and not is_admin() then
    new.is_verified := old.is_verified;
  end if;

  if (new.average_rating is distinct from old.average_rating
      or new.review_count is distinct from old.review_count)
     and not is_admin()
     and coalesce(current_setting('app.internal_rating_update', true), '') <> 'on' then
    new.average_rating := old.average_rating;
    new.review_count := old.review_count;
  end if;

  return new;
end;
$$;

create or replace function update_doctor_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Drapeau local à la transaction (3ᵉ argument `true`) : lu par
  -- prevent_self_verification() pour laisser passer cette écriture
  -- précise sans pour autant lever la protection pour un update direct
  -- venant du client.
  perform set_config('app.internal_rating_update', 'on', true);
  update public.doctors set
    average_rating = (select avg(rating) from public.reviews where doctor_id = NEW.doctor_id),
    review_count   = (select count(*) from public.reviews where doctor_id = NEW.doctor_id)
  where id = NEW.doctor_id;
  return NEW;
end;
$$;

-- ── 3. messages : content / sender_id / receiver_id / appointment_id ────
create or replace function prevent_message_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.content is distinct from old.content
      or new.sender_id is distinct from old.sender_id
      or new.receiver_id is distinct from old.receiver_id
      or new.appointment_id is distinct from old.appointment_id)
     and not is_admin() then
    new.content := old.content;
    new.sender_id := old.sender_id;
    new.receiver_id := old.receiver_id;
    new.appointment_id := old.appointment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_prevent_tampering on public.messages;
create trigger messages_prevent_tampering
before update on public.messages
for each row execute function prevent_message_tampering();

-- ── 4. notifications : title / body / type / related_id ─────────────────
create or replace function prevent_notification_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.title is distinct from old.title
      or new.body is distinct from old.body
      or new.type is distinct from old.type
      or new.related_id is distinct from old.related_id)
     and not is_admin() then
    new.title := old.title;
    new.body := old.body;
    new.type := old.type;
    new.related_id := old.related_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_prevent_tampering on public.notifications;
create trigger notifications_prevent_tampering
before update on public.notifications
for each row execute function prevent_notification_tampering();

-- ============================================================
-- Audit trail : admin_review_doctor n'écrivait aucune ligne dans
-- admin_actions_log, contrairement aux autres actions de modération
-- (063_admin_moderation.sql) — décision de validation/rejet d'un
-- praticien non tracée.
-- ============================================================
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

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'review_doctor', 'doctor', p_doctor_id, jsonb_build_object('approved', p_approve, 'reason', p_reason));
end;
$$;

-- ============================================================
-- admin_actions_log.admin_id / reports.resolved_by : les deux référencent
-- users(id) sans action ON DELETE (= RESTRICT implicite) — dès qu'un admin
-- a un jour traité un signalement ou une action de modération, son propre
-- delete_my_account() échoue avec une violation de contrainte de clé
-- étrangère. On passe en ON DELETE SET NULL : l'historique de l'action
-- reste (admin_id devient nullable), seule l'identité de son auteur se
-- perd si ce compte est supprimé.
-- ============================================================
alter table public.admin_actions_log alter column admin_id drop not null;
alter table public.admin_actions_log drop constraint if exists admin_actions_log_admin_id_fkey;
alter table public.admin_actions_log add constraint admin_actions_log_admin_id_fkey
  foreign key (admin_id) references public.users(id) on delete set null;

alter table public.reports drop constraint if exists reports_resolved_by_fkey;
alter table public.reports add constraint reports_resolved_by_fkey
  foreign key (resolved_by) references public.users(id) on delete set null;
