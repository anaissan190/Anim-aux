-- 120_email_triggers_dedicated_secret.sql
-- Audit du 05/10/2026 : les triggers d'envoi des emails/SMS d'annulation (075),
-- de report (077) et de liste d'attente (071) authentifiaient leur appel aux
-- fonctions Edge avec la clé 'service_role_key' stockée à la main dans Vault
-- (219 caractères, ancien format JWT). Depuis la bascule de Supabase vers ses
-- nouvelles clés (sb_secret_...), la valeur injectée dans les fonctions fait 41
-- caractères : l'égalité ne tient plus, les fonctions répondaient 401 et ces
-- trois familles de messages n'étaient jamais envoyées, sans erreur visible.
-- Même cause que le push (migration 099).
--
-- Correctif : réutiliser le secret dédié 'push_trigger_secret' (déjà dans Vault
-- et déjà configuré comme PUSH_TRIGGER_SECRET côté fonctions). Les fonctions
-- acceptent ce secret OU la clé service_role (voir isAuthorizedTrigger).
create or replace function public.notify_email_on_waitlist_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1;
  if v_secret is null then
    return NEW;
  end if;
  perform net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-waitlist-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
end;
$$;

create or replace function public.notify_email_sms_on_appointment_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1;
  if v_secret is null then
    return NEW;
  end if;
  perform net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-appointment-cancellation',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
end;
$$;

create or replace function public.notify_email_sms_on_appointment_rescheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1;
  if v_secret is null then
    return NEW;
  end if;
  perform net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-appointment-reschedule',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
end;
$$;
