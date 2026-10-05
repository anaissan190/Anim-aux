-- 121_notify_doctor_on_booking_and_cancellation.sql
-- Constaté lors de l'audit du 05/10/2026 : le praticien n'était jamais prévenu
-- d'une NOUVELLE RÉSERVATION ni de l'ANNULATION d'un rendez-vous par le patient
-- (seul le report par le patient le notifiait, migration 083) — il ne
-- découvrait ces changements qu'en ouvrant son agenda.
--
-- Décision d'Anaïs : notification dans l'application + push, PAS d'email ni de
-- SMS (trop lourd). Le push part tout seul pour toute ligne insérée dans
-- `notifications` (trigger de la migration 068/099) ; les triggers d'email/SMS
-- ne ciblent que d'autres types (appointment_cancelled, appointment_rescheduled,
-- waitlist) — ces deux nouveaux types n'en déclenchent donc aucun.
alter type notification_type add value if not exists 'appointment_booked';
alter type notification_type add value if not exists 'appointment_cancelled_by_patient';

create or replace function public.notify_doctor_on_new_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
  v_doctor_user_id uuid;
  v_reason text;
begin
  if NEW.status = 'confirmed' and auth.uid() = NEW.patient_id then
    select user_id into v_doctor_user_id from public.doctors where id = NEW.doctor_id;
    select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), 'Un patient')
      into v_patient_name from public.profiles p where p.user_id = NEW.patient_id;
    v_reason := nullif(trim(split_part(coalesce(NEW.reason, ''), ' — ', 1)), '');

    if v_doctor_user_id is not null then
      insert into public.notifications (user_id, type, title, body, related_id)
      values (
        v_doctor_user_id,
        'appointment_booked',
        'Nouveau rendez-vous',
        coalesce(v_patient_name, 'Un patient') || ' a réservé le '
          || to_char(NEW.start_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')
          || coalesce(' (' || v_reason || ')', '') || '.',
        NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_doctor_on_new_appointment on public.appointments;
create trigger trg_notify_doctor_on_new_appointment
  after insert on public.appointments
  for each row
  execute function public.notify_doctor_on_new_appointment();

create or replace function public.notify_doctor_on_patient_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
  v_doctor_user_id uuid;
begin
  if NEW.status = 'cancelled' and OLD.status in ('pending', 'confirmed') and auth.uid() = NEW.patient_id then
    select user_id into v_doctor_user_id from public.doctors where id = NEW.doctor_id;
    select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), 'Un patient')
      into v_patient_name from public.profiles p where p.user_id = NEW.patient_id;

    if v_doctor_user_id is not null then
      insert into public.notifications (user_id, type, title, body, related_id)
      values (
        v_doctor_user_id,
        'appointment_cancelled_by_patient',
        'Rendez-vous annulé par le patient',
        coalesce(v_patient_name, 'Un patient') || ' a annulé son rendez-vous du '
          || to_char(NEW.start_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') || '.',
        NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_doctor_on_patient_cancellation on public.appointments;
create trigger trg_notify_doctor_on_patient_cancellation
  after update on public.appointments
  for each row
  execute function public.notify_doctor_on_patient_cancellation();

-- Correction au passage : les trois notifications existantes de rendez-vous
-- (annulé / reporté par le praticien, reporté par le patient) formataient
-- l'heure avec to_char(start_at, ...) sans fuseau : le serveur est en UTC, le
-- texte affichait donc l'heure UTC (1 à 2 h de moins qu'à Paris). Même
-- correction d'ancrage sur Europe/Paris que le reste de l'application.
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
    if exists (select 1 from public.doctors d where d.id = NEW.doctor_id and d.user_id = auth.uid()) then
      select coalesce(p.first_name || ' ' || p.last_name, 'Votre praticien')
        into v_doctor_name
        from public.doctors d join public.profiles p on p.user_id = d.user_id
        where d.id = NEW.doctor_id;

      insert into public.notifications (user_id, type, title, body, related_id)
      values (
        NEW.patient_id, 'appointment_cancelled', 'Rendez-vous annulé',
        v_doctor_name || ' a annulé votre rendez-vous du ' || to_char(NEW.start_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') || '.',
        NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

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
    if exists (select 1 from public.doctors d where d.id = NEW.doctor_id and d.user_id = auth.uid()) then
      select coalesce(p.first_name || ' ' || p.last_name, 'Votre praticien')
        into v_doctor_name
        from public.doctors d join public.profiles p on p.user_id = d.user_id
        where d.id = NEW.doctor_id;

      insert into public.notifications (user_id, type, title, body, related_id)
      values (
        NEW.patient_id, 'appointment_rescheduled', 'Rendez-vous reporté',
        v_doctor_name || ' a reporté votre rendez-vous au ' || to_char(NEW.start_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') || '.',
        NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

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
      into v_patient_name from public.profiles p where p.user_id = NEW.patient_id;

    insert into public.notifications (user_id, type, title, body, related_id)
    values (
      (select user_id from public.doctors where id = NEW.doctor_id),
      'appointment_rescheduled', 'Rendez-vous reprogrammé par le patient',
      v_patient_name || ' a déplacé son rendez-vous au ' || to_char(NEW.start_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') || '.',
      NEW.id
    );
  end if;
  return NEW;
end;
$$;
