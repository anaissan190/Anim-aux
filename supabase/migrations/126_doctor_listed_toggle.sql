-- ============================================================
-- ANIMÉAUX — Un praticien peut se retirer de la recherche (11/10/2026)
-- ============================================================
-- Interrupteur « Visible dans la recherche » : un praticien vérifié peut
-- masquer sa fiche au public (vacances, pause, compte de démonstration…)
-- SANS toucher à son statut de vérification — il garde l'accès complet à son
-- espace praticien, contrairement à un retour à « pending » (qui le renverrait
-- sur l'écran de dépôt de documents) et sans passer par la protection
-- prevent_self_verification (migration 079), qui verrouille verification_status.
--
-- Qui voit encore une fiche masquée (policy ci-dessous) :
--   * le praticien lui-même et les administrateurs ;
--   * un patient qui a (eu) un rendez-vous avec lui — nécessaire pour que ses
--     rendez-vous, messages et documents continuent d'afficher le praticien.
-- La recherche (useDoctors) et la fiche directe (DoctorPage) filtrent en plus
-- explicitement sur is_listed, sinon ce patient continuerait à retrouver un
-- praticien masqué dans les résultats.
-- ============================================================

alter table public.doctors
  add column if not exists is_listed boolean not null default true;

-- Même définition que la migration 097 (sans récursion RLS : l'accès via les
-- rendez-vous passe par une fonction SECURITY DEFINER), plus is_listed.
drop policy if exists "doctors: lecture publique verifiee" on public.doctors;
create policy "doctors: lecture publique verifiee" on public.doctors for select using (
  (verification_status = 'verified' and is_listed)
  or auth.uid() = user_id
  or is_admin()
  or has_appointment_with_doctor(doctors.id)
);

notify pgrst, 'reload schema';
