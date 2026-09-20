-- ============================================================
-- Renforcement du parcours de vérification des praticiens
-- ============================================================
-- Anaïs a demandé (21/09/2026) à valider tout le parcours de
-- vérification praticien (dépôt de documents, notification à l'admin,
-- non-visibilité publique avant validation). Deux manques trouvés en
-- relisant le code :
--
-- 1. Aucune notification n'était envoyée à l'administrateur quand un
--    praticien dépose un document justificatif — il fallait vérifier
--    manuellement le tableau de bord admin pour le découvrir.
--
-- 2. La policy RLS de lecture sur `doctors` ("doctors: lecture
--    publique", migration 001) était `using (true)` — totalement
--    ouverte, sans condition sur verification_status. La recherche
--    (useDoctors) exclut bien les praticiens non vérifiés via un
--    filtre côté requête, mais ce n'est qu'une convention de l'UI :
--    la fiche publique d'un praticien (/doctor/:id) restait accessible
--    en lien direct même non vérifié, et n'importe qui muni de la clé
--    anon (publique, embarquée dans le JS) pouvait lister TOUS les
--    praticiens via l'API REST de Supabase, statut compris, en
--    contournant entièrement le filtre de l'UI.
-- ============================================================

-- ── 1. Notification à l'admin au dépôt d'un document ────────────────────

alter type notification_type add value if not exists 'doctor_document_submitted';

create or replace function notify_admin_on_verification_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_name text;
  v_admin record;
begin
  select coalesce(p.first_name || ' ' || p.last_name, 'Un praticien')
    into v_doctor_name
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
    where d.id = NEW.doctor_id;

  -- Plusieurs comptes peuvent être admin (is_admin est un booléen
  -- indépendant du rôle, migration 055) — chacun reçoit sa propre
  -- notification plutôt qu'une seule ligne pointant vers un admin fixe.
  for v_admin in select id from public.users where is_admin = true loop
    insert into public.notifications (user_id, type, title, body, related_id)
    values (
      v_admin.id,
      'doctor_document_submitted',
      'Document à vérifier',
      v_doctor_name || ' a déposé un document (' || coalesce(NEW.document_type, 'justificatif') || ') à valider.',
      NEW.doctor_id
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists doctor_verification_documents_notify_admin on public.doctor_verification_documents;
create trigger doctor_verification_documents_notify_admin
after insert on public.doctor_verification_documents
for each row execute function notify_admin_on_verification_document();

-- ── 2. La fiche praticien n'est plus publique tant qu'elle n'est pas
--       vérifiée — sauf pour le praticien lui-même, un admin, ou un
--       patient ayant déjà un rendez-vous avec lui (pour ne pas casser
--       l'affichage de son historique de RDV si son statut change).

-- useClinicMembers (src/hooks/useData.ts) fait un join client direct
-- clinic_members -> doctors (pas de RPC security definer) pour afficher
-- l'équipe de "Mon cabinet" : sans cette clause, un collègue pas encore
-- vérifié aurait disparu de la liste pour tout le reste de l'équipe.
drop policy if exists "doctors: lecture publique" on public.doctors;
create policy "doctors: lecture publique verifiee" on public.doctors for select using (
  verification_status = 'verified'
  or auth.uid() = user_id
  or is_admin()
  or exists (
    select 1 from public.appointments a
    where a.doctor_id = doctors.id and a.patient_id = auth.uid()
  )
  or exists (
    select 1 from public.clinic_members viewer_cm
    join public.clinic_members target_cm on target_cm.clinic_id = viewer_cm.clinic_id
    join public.doctors viewer_doc on viewer_doc.id = viewer_cm.doctor_id
    where target_cm.doctor_id = doctors.id
      and viewer_doc.user_id = auth.uid()
  )
);
