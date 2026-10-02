-- 112_delete_clinic.sql
-- Un praticien créateur d'un cabinet ne pouvait nulle part le fermer (ex. il
-- change d'activité, reprend une activité seule ou salariée) — repéré par
-- Anaïs le 02/10/2026. La policy "clinics: owner supprime" (migration 039)
-- autorisait déjà un delete direct côté base, seul le bouton manquait côté
-- frontend ; cette migration n'ajoute qu'un garde-fou côté serveur, pas de
-- nouvelle permission.
--
-- Garde-fou : interdit de supprimer un cabinet tant que d'autres praticiens
-- en sont membres — sans lui, ses confrères perdraient silencieusement
-- l'accès au cabinet partagé (patientèle, tarifs communs, agenda partagé),
-- `clinic_members`/`clinic_services`/`clinic_staff` étant tous en
-- "on delete cascade" depuis `clinics`. Appliqué en trigger plutôt qu'en
-- simple vérification côté client, pour que la règle tienne même si l'appel
-- ne passe pas par l'écran prévu — même esprit que les triggers anti-triche
-- déjà en place (prevent_animal_record_reassignment, transitions de
-- animal_referrals...). Le créateur retire d'abord ses confrères un par un
-- (fonctionnalité déjà existante, remove_clinic_member) avant de pouvoir
-- supprimer le cabinet.
create or replace function public.prevent_clinic_deletion_with_other_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_doctor_id uuid;
  other_members_count integer;
begin
  select id into owner_doctor_id from public.doctors where user_id = old.owner_id;

  select count(*) into other_members_count
  from public.clinic_members
  where clinic_id = old.id
    and (owner_doctor_id is null or doctor_id <> owner_doctor_id);

  if other_members_count > 0 then
    raise exception 'Retirez d''abord les autres praticiens du cabinet avant de pouvoir le supprimer.';
  end if;

  return old;
end;
$$;

drop trigger if exists clinics_prevent_deletion_with_members on public.clinics;
create trigger clinics_prevent_deletion_with_members
before delete on public.clinics
for each row execute function public.prevent_clinic_deletion_with_other_members();
