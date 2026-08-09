-- ============================================================
-- ANIMÉAUX — Email + SMS quand un praticien annule un RDV confirmé
-- ============================================================
-- Complète la notification in-app déjà en place (migration 074) : même
-- mécanisme pg_net + Vault que les triggers des migrations 068 (push) et
-- 071 (email liste d'attente), appelle la fonction Edge
-- send-appointment-cancellation qui envoie l'email (Resend) et le SMS (OVH)
-- au patient.
--
-- Dépend du secret Vault 'service_role_key' déjà requis par la migration
-- 068 pour le push — si tu l'as déjà créé à l'époque, rien à refaire ici.
-- Sinon (select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');),
-- ce trigger part silencieusement sans rien envoyer, comme les autres.

create or replace function public.notify_email_sms_on_appointment_cancelled()
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
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-appointment-cancellation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_email_sms_on_appointment_cancelled on public.notifications;
create trigger trg_notify_email_sms_on_appointment_cancelled
after insert on public.notifications
for each row
when (NEW.type = 'appointment_cancelled')
execute function public.notify_email_sms_on_appointment_cancelled();
