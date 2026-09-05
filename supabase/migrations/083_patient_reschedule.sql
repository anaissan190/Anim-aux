-- ============================================================
-- ANIMÉAUX — Reprogrammation d'un RDV par le patient lui-même
-- ============================================================
-- Jusqu'ici, un patient ne pouvait qu'annuler son RDV (policy "appointments:
-- patient peut annuler le sien", 069) — pour le déplacer à un autre
-- créneau, il devait annuler puis reréserver, ou passer par la messagerie
-- pour demander au praticien. Ajoute la possibilité de reporter
-- directement son propre RDV confirmé et à venir, même mécanisme que le
-- bouton "Reporter" déjà en place côté praticien (useRescheduleAppointment,
-- AppointmentCard.tsx).
--
-- 1) RLS : nouvelle policy UPDATE pour le patient, restreinte à ses
--    propres RDV encore "confirmed" et à au moins 24h de l'heure du RDV
--    (délai symétrique au rappel automatique envoyé 24h avant, pour ne
--    pas laisser un patient déplacer un RDV que le praticien s'apprête
--    déjà à honorer). WITH CHECK explicite sur patient_id ET status (doit
--    rester "confirmed") : sans lui, la policy réutiliserait USING comme
--    WITH CHECK et n'empêcherait pas un patient de glisser un autre
--    changement de statut dans le même appel. Le verrou déjà en place sur
--    patient_id/doctor_id (migration 079, trigger, pas cette policy) et
--    sur notes (migration 080) continue de s'appliquer par-dessus.
-- 2) Notification : le praticien n'était prévenu d'un changement de
--    créneau que si c'était LUI qui l'avait déclenché (migration 077,
--    condition explicite sur auth.uid() = doctor du RDV). Trigger
--    symétrique ici pour le cas où c'est le patient qui reporte.
-- ============================================================

drop policy if exists "appointments: patient peut reporter le sien" on public.appointments;
create policy "appointments: patient peut reporter le sien" on public.appointments
  for update
  using (auth.uid() = patient_id and status = 'confirmed' and start_at > now() + interval '24 hours')
  with check (auth.uid() = patient_id and status = 'confirmed');

create or replace function public.notify_appointment_rescheduled_by_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
begin
  if NEW.status = 'confirmed' and OLD.status = 'confirmed' and NEW.start_at <> OLD.start_at
     and auth.uid() = NEW.patient_id then
    select coalesce(p.first_name || ' ' || p.last_name, 'Un patient')
      into v_patient_name
      from public.profiles p
      where p.user_id = NEW.patient_id;

    insert into public.notifications (user_id, type, title, body, related_id)
    values (
      (select user_id from public.doctors where id = NEW.doctor_id),
      'appointment_rescheduled',
      'Rendez-vous reprogrammé par le patient',
      v_patient_name || ' a déplacé son rendez-vous au ' || to_char(NEW.start_at, 'DD/MM/YYYY à HH24:MI') || '.',
      NEW.id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_appointment_rescheduled_by_patient on public.appointments;
create trigger trg_notify_appointment_rescheduled_by_patient
  after update on public.appointments
  for each row
  execute function public.notify_appointment_rescheduled_by_patient();
