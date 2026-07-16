-- ============================================================
-- ANIMÉAUX — Corrige un bug où les prestations/tarifs d'un praticien
-- SANS cabinet n'étaient jamais sauvegardées (simple état React local
-- côté DoctorDashboard, perdu à chaque rafraîchissement de page).
-- On réutilise la table clinic_services existante : une prestation
-- "personnelle" a clinic_id = null et seul son doctor_id l'identifie.
-- Les policies existantes ("membres peuvent gérer"/"membres peuvent voir",
-- basées sur get_my_clinic_ids()) ne sont pas touchées : elles continuent
-- de couvrir uniquement le cas clinic_id IS NOT NULL. On ajoute deux
-- policies supplémentaires pour le cas personnel (clinic_id IS NULL).
-- ============================================================

alter table public.clinic_services alter column clinic_id drop not null;

drop policy if exists "clinic_services: praticien voit ses prestations personnelles" on public.clinic_services;
create policy "clinic_services: praticien voit ses prestations personnelles" on public.clinic_services for select using (
  clinic_id is null and doctor_id = (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "clinic_services: praticien gère ses prestations personnelles" on public.clinic_services;
create policy "clinic_services: praticien gère ses prestations personnelles" on public.clinic_services for all using (
  clinic_id is null and doctor_id = (select id from public.doctors where user_id = auth.uid())
) with check (
  clinic_id is null and doctor_id = (select id from public.doctors where user_id = auth.uid())
);

notify pgrst, 'reload schema';
