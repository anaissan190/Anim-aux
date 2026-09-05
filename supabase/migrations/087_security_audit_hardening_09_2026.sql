-- ============================================================
-- ANIMÉAUX — Durcissement suite à l'audit de sécurité du 05/09/2026
-- ============================================================
-- Quatre failles distinctes trouvées lors d'un audit applicatif complet
-- (8 revues parallèles couvrant RLS, Edge Functions, hooks, dashboards) :
-- toutes exploitables dès aujourd'hui, corrigées ici.
-- ============================================================

-- ============================================================
-- 1) Un patient pouvait auto-confirmer un RDV en attente ET le déplacer
--    à sa guise, en contournant la validation du praticien.
-- ============================================================
-- Cause : deux policies UPDATE permissives distinctes existent pour le
-- patient sur `appointments` — "annuler le sien" (084, USING autorise
-- status in pending/confirmed, WITH CHECK exige status='cancelled') et
-- "reporter le sien" (085, USING exige status='confirmed', WITH CHECK
-- exige status='confirmed'). Postgres combine TOUTES les policies
-- permissives applicables par OR, séparément pour USING et pour WITH
-- CHECK, sans les apparier à la policy d'origine (voir doc CREATE POLICY,
-- section "Multiple applicable policies"). Un patient pouvait donc
-- satisfaire le USING de "annuler" (RDV encore 'pending') puis le WITH
-- CHECK de "reporter" (qui exige seulement status='confirmed' pour la
-- ligne, sans se soucier du statut précédent) en un seul appel PATCH
-- direct sur l'API REST — validant lui-même son propre RDV en attente et
-- le déplaçant où il veut, sans jamais passer par le praticien.
--
-- Un simple ajustement de policy ne suffit pas ici : le problème vient de
-- la combinaison ENTRE deux policies, pas d'une policy prise seule. Un
-- trigger BEFORE UPDATE (comme les autres verrous anti-tampering déjà en
-- place, 079/080/081) a accès direct à OLD et NEW et referme le trou
-- indépendamment de la façon dont les policies RLS ont laissé passer
-- l'update.
create or replace function public.prevent_patient_illegal_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.patient_id and not is_admin() then
    if old.status not in ('pending', 'confirmed') then
      raise exception 'Ce rendez-vous ne peut plus être modifié.';
    end if;

    if new.status = 'cancelled' then
      -- Annulation : autorisée depuis pending ou confirmed (084).
      null;
    elsif new.status = 'confirmed' and old.status = 'confirmed' then
      -- Report : autorisé uniquement si le RDV était déjà confirmé (085) —
      -- jamais depuis 'pending', seul le praticien peut confirmer un RDV
      -- en attente (bouton "Confirmer", policy "médecin peut modifier").
      null;
    else
      raise exception 'Transition de statut non autorisée pour un patient.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_prevent_patient_illegal_transition on public.appointments;
create trigger appointments_prevent_patient_illegal_transition
before update on public.appointments
for each row execute function public.prevent_patient_illegal_status_transition();

-- ============================================================
-- 2) verification_rejected_reason (motif de rejet admin, potentiellement
--    diffamatoire) était lisible par n'importe quel visiteur non connecté.
-- ============================================================
-- `doctors` a une policy "lecture publique" (using(true)) et `profiles:
-- médecins visibles` n'exclut pas le rôle anon — un visiteur pouvait donc
-- lire ce champ pour n'importe quel praticien rejeté, associé à son vrai
-- nom, sans le moindre compte. Revoke ciblé sur `anon` uniquement (pas
-- `authenticated`, dont useCurrentDoctor a besoin via select('*') pour
-- afficher la bannière de statut au praticien lui-même) : ferme l'accès
-- public non authentifié, le scénario le plus sévère (aucune barrière du
-- tout). Un compte patient authentifié pourrait encore le lire directement
-- via l'API REST (limite connue de ce correctif ciblé) — nécessiterait de
-- retravailler les selects publics de useDoctor/useDoctors pour fermer
-- complètement, laissé de côté ici pour ne pas casser select('*').
revoke select (verification_rejected_reason) on public.doctors from anon;

-- ============================================================
-- 3) N'importe quel utilisateur connecté pouvait écraser (upsert) le
--    fichier de stockage d'un autre dans les buckets "avatars"/"documents".
-- ============================================================
-- Les policies UPDATE de 004/025 ne vérifiaient que bucket_id, jamais le
-- propriétaire du fichier — contrairement à la policy DELETE de
-- "documents" (025), qui vérifie déjà owner = auth.uid(). Un patient
-- connaissant/devinant le chemin de stockage d'un document déjà partagé
-- (ordonnance, avatar) pouvait le remplacer silencieusement.
drop policy if exists "avatars: remplacement par utilisateur connecté" on storage.objects;
create policy "avatars: remplacement par utilisateur connecté" on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "documents: remplacement par utilisateur connecté" on storage.objects;
create policy "documents: remplacement par utilisateur connecté" on storage.objects for update
  to authenticated
  using (bucket_id = 'documents' and owner = auth.uid())
  with check (bucket_id = 'documents' and owner = auth.uid());

-- ============================================================
-- 4) Un patient pouvait forger la réponse du praticien à son propre avis.
-- ============================================================
-- reply_to_review() (067) est bien SECURITY DEFINER et ne touche qu'à
-- doctor_reply/doctor_reply_at après vérification du praticien appelant —
-- mais la policy générique "reviews: patient modifie son avis" (011,
-- using/with check sur patient_id) reste une policy RLS "for update"
-- classique, qui ne restreint aucune colonne. Le patient auteur de l'avis
-- pouvait donc appeler l'API REST directement (PATCH reviews avec
-- doctor_reply='...') et faire apparaître une fausse réponse "du
-- praticien" sous son propre avis. Extension du trigger existant
-- (081, verrouille déjà doctor_id/appointment_id) plutôt qu'une nouvelle
-- policy : reply_to_review() reste la seule voie légitime, elle passe par
-- auth.uid() du praticien concerné (inchangé par SECURITY DEFINER), donc
-- continue de fonctionner normalement à travers ce trigger.
create or replace function prevent_review_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.doctor_id is distinct from old.doctor_id
      or new.appointment_id is distinct from old.appointment_id)
     and not is_admin() then
    new.doctor_id := old.doctor_id;
    new.appointment_id := old.appointment_id;
  end if;

  if (new.doctor_reply is distinct from old.doctor_reply
      or new.doctor_reply_at is distinct from old.doctor_reply_at)
     and not is_admin()
     and not exists (
       select 1 from public.doctors d where d.id = old.doctor_id and d.user_id = auth.uid()
     ) then
    new.doctor_reply := old.doctor_reply;
    new.doctor_reply_at := old.doctor_reply_at;
  end if;

  return new;
end;
$$;

-- Le trigger existant (081) pointe déjà vers cette fonction, pas besoin de
-- le recréer — CREATE OR REPLACE FUNCTION suffit à appliquer le changement.

-- ============================================================
-- 5) FK doctors_user_id_profiles_fkey sans ON DELETE : la suppression
--    d'un compte praticien pouvait échouer (violation de contrainte),
--    bloquant le droit à l'effacement (RGPD) pour ce rôle.
-- ============================================================
-- Ajoutée en 042 comme simple "hint" d'embed PostgREST, cette contrainte
-- est RESTRICT par défaut alors que `doctors` ET `profiles` sont chacun
-- déjà en CASCADE depuis `users`. Si la ligne `profiles` d'un praticien
-- est effacée avant sa ligne `doctors` lors de la cascade déclenchée par
-- delete_my_account(), cette contrainte lève une violation de clé
-- étrangère et annule toute la suppression du compte.
alter table public.doctors
  drop constraint if exists doctors_user_id_profiles_fkey;
alter table public.doctors
  add constraint doctors_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(user_id) on delete cascade;

notify pgrst, 'reload schema';
