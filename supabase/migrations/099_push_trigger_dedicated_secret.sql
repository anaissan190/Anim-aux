-- ============================================================
-- Le trigger d'envoi de push (migration 068) authentifiait son appel à la
-- fonction Edge send-push avec la clé service_role du projet, stockée à la
-- main dans Vault. Depuis la bascule de Supabase vers son nouveau format de
-- clés (sb_secret_...), la valeur réellement injectée dans les fonctions
-- Edge (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ne correspond plus à
-- l'ancienne clé JWT récupérable dans Settings > API — les deux formats
-- coexistent mais ne sont plus interchangeables, ce qui rendait le push
-- silencieusement bloqué (401) depuis le début (diagnostiqué le
-- 22/09/2026 via les logs de send-push, qui révèlent la vraie longueur
-- attendue : 41 caractères, pas les 219 de l'ancien format JWT).
--
-- Correctif définitif : un secret dédié à ce seul usage (jamais la clé
-- service_role elle-même, qui donne un accès complet à toute la base) —
-- immunisé contre un futur changement de format des clés Supabase.
-- ============================================================

create or replace function public.notify_push_on_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger_secret text;
begin
  select decrypted_secret into v_trigger_secret
  from vault.decrypted_secrets
  where name = 'push_trigger_secret'
  limit 1;

  if v_trigger_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_trigger_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
end;
$$;
