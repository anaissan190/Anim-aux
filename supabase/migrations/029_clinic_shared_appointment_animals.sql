-- ============================================================
-- ANIMÉAUX — Visibilité des animaux liés à un RDV entre confrères
-- de cabinet. La policy RLS de `appointment_animals` (migration 012)
-- ne permettait de voir le lien RDV↔animal qu'au patient concerné ou
-- au praticien assigné au RDV. Résultat : dans l'agenda partagé, les
-- RDV des collègues s'affichaient bien (grâce à la migration 027)
-- mais sans le nom de l'animal, puisque la jointure
-- appointment_animals(animals(...)) était bloquée par le RLS pour
-- tout autre praticien que celui du RDV.
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

drop policy if exists "appointment_animals: médecin voit celles du cabinet" on public.appointment_animals;
create policy "appointment_animals: médecin voit celles du cabinet" on public.appointment_animals for select using (
  exists (
    select 1
    from public.appointments a
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where a.id = appointment_animals.appointment_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);
