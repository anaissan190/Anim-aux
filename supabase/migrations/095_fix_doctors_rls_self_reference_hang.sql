-- ============================================================
-- Correctif urgent : la policy RLS de lecture sur `doctors` (migration
-- 094, la veille) bloquait indéfiniment le chargement du tableau de bord
-- praticien — repéré par Anaïs le 21/09/2026 via un écran de chargement
-- qui ne se terminait jamais, même après plusieurs minutes.
-- ============================================================
-- Cause : la clause "collègue de cabinet" de la policy relisait la table
-- `doctors` elle-même (`viewer_doc` dans le join) DEPUIS L'INTÉRIEUR de sa
-- propre policy de lecture. Toute lecture de `doctors`, même imbriquée
-- dans la clause d'une autre ligne, redéclenche l'évaluation de CETTE
-- MÊME policy pour les lignes lues — chaque ligne "viewer_doc" pouvant à
-- son tour retomber sur la branche "collègue de cabinet" et relire
-- `doctors` une nouvelle fois. Pas une récursion infinie au sens strict
-- (Postgres finit par buter sur sa limite de profondeur de pile), mais un
-- coût d'évaluation qui explose au point de sembler bloqué indéfiniment
-- côté client, bien avant d'atteindre cette limite.
--
-- Corrigé en suivant le même principe que is_admin() (003/055) : une
-- fonction security definer qui résout "suis-je collègue de ce
-- praticien ?" sans jamais repasser par la policy RLS de `doctors` —
-- security definer exécute avec les droits du propriétaire de la
-- fonction, qui contourne RLS ici comme partout ailleurs dans ce projet.
create or replace function is_clinic_teammate_of(target_doctor_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.clinic_members viewer_cm
    join public.clinic_members target_cm on target_cm.clinic_id = viewer_cm.clinic_id
    join public.doctors viewer_doc on viewer_doc.id = viewer_cm.doctor_id
    where target_cm.doctor_id = target_doctor_id
      and viewer_doc.user_id = auth.uid()
  );
$$;

drop policy if exists "doctors: lecture publique verifiee" on public.doctors;
create policy "doctors: lecture publique verifiee" on public.doctors for select using (
  verification_status = 'verified'
  or auth.uid() = user_id
  or is_admin()
  or exists (
    select 1 from public.appointments a
    where a.doctor_id = doctors.id and a.patient_id = auth.uid()
  )
  or is_clinic_teammate_of(doctors.id)
);
