-- Rend les avis indépendants d'un rendez-vous précis : un patient peut
-- laisser un avis sur un praticien à tout moment, pas seulement après un
-- RDV marqué "completed". On garde un avis par (patient, praticien) — un
-- nouvel envoi met à jour l'avis existant plutôt que d'en créer un second.
-- À exécuter APRÈS 010_appointments_no_show_status.sql.

alter table public.reviews
  alter column appointment_id drop not null;

alter table public.reviews
  add constraint reviews_patient_doctor_unique unique (patient_id, doctor_id);

drop policy if exists "reviews: patient crée après RDV" on public.reviews;
create policy "reviews: patient crée un avis" on public.reviews for insert with check (
  auth.uid() = patient_id
);

drop policy if exists "reviews: patient modifie son avis" on public.reviews;
create policy "reviews: patient modifie son avis" on public.reviews for update using (
  auth.uid() = patient_id
) with check (
  auth.uid() = patient_id
);

drop policy if exists "reviews: lecture publique" on public.reviews;
create policy "reviews: lecture publique" on public.reviews for select using (true);
