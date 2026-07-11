-- ============================================================
-- ANIMÉAUX — Visibilité des RDV entre praticiens d'un même cabinet
-- Jusqu'ici, un praticien ne pouvait voir QUE ses propres RDV
-- (policy "appointments: médecin voit les siens"), même en
-- interrogeant explicitement les doctor_id de ses collègues de
-- cabinet côté client (agenda partagé) : le RLS bloquait la
-- lecture avant même d'arriver au client, donc l'agenda partagé
-- n'affichait jamais les RDV pris avec un collègue.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

drop policy if exists "appointments: médecin voit celles du cabinet" on public.appointments;
create policy "appointments: médecin voit celles du cabinet" on public.appointments for select using (
  exists (
    select 1
    from public.clinic_members cm_collegue
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where cm_collegue.doctor_id = appointments.doctor_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);
