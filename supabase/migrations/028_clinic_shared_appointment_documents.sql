-- ============================================================
-- ANIMÉAUX — Visibilité des pièces jointes de RDV entre confrères
-- de cabinet. Jusqu'ici, seul le praticien assigné au RDV pouvait
-- voir les documents joints à la prise de RDV (appointment_documents).
-- Puisque l'agenda partagé montre désormais les RDV de tout le
-- cabinet, un collègue doit aussi pouvoir consulter les pièces
-- jointes d'un RDV qui n'est pas le sien.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

drop policy if exists "appointment_documents: médecin voit celles du cabinet" on public.appointment_documents;
create policy "appointment_documents: médecin voit celles du cabinet" on public.appointment_documents for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.id = appointment_documents.appointment_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);
