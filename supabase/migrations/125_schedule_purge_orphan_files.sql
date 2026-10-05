-- 125_schedule_purge_orphan_files.sql
-- Planifie chaque dimanche à 03:30 UTC le nettoyage des fichiers de stockage
-- orphelins (Edge Function purge-orphan-files). Le secret n'est écrit nulle part
-- en clair : le job le relit à chaque exécution dans Vault ('push_trigger_secret'),
-- comme les triggers d'email (migration 120) — aucun risque de désynchronisation.
-- Prérequis : extensions pg_cron et pg_net (déjà actives pour send-reminders).
--
-- Pour vérifier d'abord sans rien supprimer, appeler la fonction avec ?dry_run=1
-- (voir le bloc de test fourni avec cette migration).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-orphan-files-weekly') then
    perform cron.unschedule('purge-orphan-files-weekly');
  end if;
end $$;

select cron.schedule(
  'purge-orphan-files-weekly',
  '30 3 * * 0',
  $$
  select net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/purge-orphan-files',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
