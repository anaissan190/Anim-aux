-- Notifie le patient quand SON praticien annule un rendez-vous qu'il
-- avait confirmé (nouveau bouton "Annuler" côté praticien sur
-- AppointmentCard). Le type de notification appointment_cancelled
-- existe dans l'enum depuis le tout premier schéma mais n'était encore
-- utilisé nulle part.
--
-- Ne se déclenche que si c'est bien le PRATICIEN qui a fait passer le
-- statut à cancelled (vérifié via auth.uid() = doctors.user_id) : le
-- patient a son propre bouton "Annuler" sur ses RDV pending/confirmed,
-- et il n'a pas besoin d'être notifié de sa propre annulation.

create or replace function public.notify_appointment_cancelled_by_doctor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_name text;
begin
  if NEW.status = 'cancelled' and OLD.status = 'confirmed' then
    if exists (
      select 1 from public.doctors d
      where d.id = NEW.doctor_id and d.user_id = auth.uid()
    ) then
      select coalesce(p.first_name || ' ' || p.last_name, 'Votre praticien')
        into v_doctor_name
        from public.doctors d
        join public.profiles p on p.user_id = d.user_id
        where d.id = NEW.doctor_id;

      insert into public.notifications (user_id, type, title, body, related_id)
      values (
        NEW.patient_id,
        'appointment_cancelled',
        'Rendez-vous annulé',
        v_doctor_name || ' a annulé votre rendez-vous du ' || to_char(NEW.start_at, 'DD/MM/YYYY à HH24:MI') || '.',
        NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_appointment_cancelled on public.appointments;
create trigger trg_notify_appointment_cancelled
  after update on public.appointments
  for each row
  execute function public.notify_appointment_cancelled_by_doctor();
