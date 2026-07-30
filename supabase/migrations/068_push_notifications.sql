-- ============================================================
-- ANIMÉAUX — Notifications push navigateur
-- ============================================================
-- L'app est déjà une PWA avec service worker (migration précédente côté
-- code). Cette migration ajoute la table des abonnements push, un
-- déclencheur qui appelle une fonction Edge à chaque nouvelle ligne dans
-- `notifications` (déjà le point central de toutes les notifications :
-- RDV confirmé/annulé, nouveau message, avis, etc. — voir table
-- `notifications`, 001_schema.sql), et la fonction Edge qui envoie
-- réellement le push via VAPID/Web Push.
--
-- IMPORTANT — étapes manuelles à faire APRÈS avoir exécuté ce fichier
-- (voir message qui l'accompagne dans le chat) :
--   1) select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   2) Déployer la fonction Edge supabase/functions/send-push
--   3) Configurer ses secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
-- Sans ces étapes, les notifications continuent de fonctionner normalement
-- en in-app (cloche) — seul l'envoi du push navigateur ne partira pas
-- (le trigger se contente de ne rien faire si le secret Vault est absent).
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: propriétaire seul (lecture)" on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy "push_subscriptions: propriétaire seul (création)" on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "push_subscriptions: propriétaire seul (suppression)" on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- pg_net : permet d'appeler une URL HTTP (la fonction Edge) depuis un
-- trigger SQL, de façon asynchrone (ne bloque jamais l'insertion de la
-- notification elle-même même si l'envoi du push échoue ou est lent).
create extension if not exists pg_net;

create or replace function public.notify_push_on_new_notification()
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

  -- Vault pas encore configuré (étape manuelle) : on ne bloque jamais la
  -- notification in-app pour autant, on part silencieusement.
  if v_service_key is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_push_on_new_notification on public.notifications;
create trigger trg_notify_push_on_new_notification
after insert on public.notifications
for each row execute function public.notify_push_on_new_notification();
