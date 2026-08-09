-- ============================================================
-- ANIMÉAUX — Report de RDV par le praticien (notification in-app + email/SMS)
-- ============================================================
-- Bouton "Reporter" côté praticien sur un RDV confirmé (AppointmentCard.tsx,
-- useRescheduleAppointment) : le praticien choisit directement un nouveau
-- créneau, sans étape de validation par le patient — celui-ci est
-- simplement prévenu du changement, sur les mêmes trois canaux que
-- l'annulation (migrations 074/075) : notification in-app, email, SMS.
--
-- Même structure à deux triggers que l'annulation : le premier détecte le
-- changement sur appointments et crée la notification in-app, le second
-- réagit à cette notification pour appeler la fonction Edge d'email/SMS.

create or replace function public.notify_appointment_rescheduled_by_doctor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_name text;
begin
  if NEW.status = 'confirmed' and OLD.status = 'confirmed' and NEW.start_at <> OLD.start_at then
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
        'appointment_rescheduled',
        'Rendez-vous reporté',
        v_doctor_name || ' a reporté votre rendez-vous au ' || to_char(NEW.start_at, 'DD/MM/YYYY à HH24:MI') || '.',
        NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_appointment_rescheduled on public.appointments;
create trigger trg_notify_appointment_rescheduled
  after update on public.appointments
  for each row
  execute function public.notify_appointment_rescheduled_by_doctor();

-- Email + SMS, même mécanisme pg_net/Vault que les migrations 068/071/075.
create or replace function public.notify_email_sms_on_appointment_rescheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_key text;
begin
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if v_service_key is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-appointment-reschedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_email_sms_on_appointment_rescheduled on public.notifications;
create trigger trg_notify_email_sms_on_appointment_rescheduled
after insert on public.notifications
for each row
when (NEW.type = 'appointment_rescheduled')
execute function public.notify_email_sms_on_appointment_rescheduled();
