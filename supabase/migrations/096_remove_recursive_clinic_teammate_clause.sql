-- ============================================================
-- Correctif définitif : la migration 095 pensait résoudre la récursion sur
-- `doctors` en déplaçant la clause "collègue de cabinet" dans une fonction
-- security definer (is_clinic_teammate_of), mais ça n'a pas suffi — confirmé
-- par Anaïs le 22/09/2026 via les Postgres Logs, qui montrent l'erreur
-- "infinite recursion detected in policy for relation doctors" se répéter
-- à chaque tentative de chargement du tableau de bord praticien, encore
-- après application de la 095.
--
-- Cause réelle : is_clinic_teammate_of() relit `public.doctors` (alias
-- viewer_doc) DEPUIS L'INTÉRIEUR d'une fonction appelée PAR la policy de
-- lecture de `doctors` elle-même. Security definer ne suffit pas à éviter
-- la détection de récursion de Postgres dans ce cas précis — ce projet l'a
-- déjà appris à ses dépens sur clinics/clinic_members (migrations 040 et
-- 041) : la vraie règle est qu'une policy ne doit JAMAIS faire relire sa
-- propre table, même indirectement via une fonction.
--
-- La clause "collègues de cabinet se voient entre eux" était un ajout de
-- confort de la migration 094 (jamais demandé explicitement), pas une
-- fonctionnalité essentielle : les collègues d'un même cabinet restent
-- visibles entre eux via `clinic_members` (déjà accessible), et un
-- praticien vérifié reste visible publiquement de toute façon. On retire
-- simplement cette clause plutôt que de complexifier davantage le schéma
-- (ex: table de correspondance séparée) pour une urgence de production.
-- ============================================================

drop policy if exists "doctors: lecture publique verifiee" on public.doctors;
create policy "doctors: lecture publique verifiee" on public.doctors for select using (
  verification_status = 'verified'
  or auth.uid() = user_id
  or is_admin()
  or exists (
    select 1 from public.appointments a
    where a.doctor_id = doctors.id and a.patient_id = auth.uid()
  )
);

drop function if exists public.is_clinic_teammate_of(uuid);

notify pgrst, 'reload schema';
