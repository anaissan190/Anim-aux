-- ============================================================
-- ANIMÉAUX — Email en plus du push/in-app pour la liste d'attente
-- ============================================================
-- Demandé le 30/07/2026 : la notification in-app + push fonctionnent déjà
-- (migrations 065 et 068), mais tout le monde n'a pas activé les
-- notifications push du navigateur. Un email est donc envoyé en parallèle
-- spécifiquement pour ce type de notification (pas les autres — les avis,
-- messages, RDV confirmé ont déjà leur propre traitement dédié ou ne s'y
-- prêtent pas), même mécanisme pg_net + Vault que le trigger push de la
-- migration 068.

create or replace function public.notify_email_on_waitlist_notification()
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
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-waitlist-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_email_on_waitlist_notification on public.notifications;
create trigger trg_notify_email_on_waitlist_notification
after insert on public.notifications
for each row
when (NEW.type = 'waitlist_slot_available')
execute function public.notify_email_on_waitlist_notification();
