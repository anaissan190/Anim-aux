-- ============================================================
-- Activation du realtime Postgres sur la table messages
-- ============================================================
-- La messagerie (src/pages/MessagesPage.tsx) fonctionnait jusqu'ici par
-- polling toutes les 5 secondes (useConversation / useConversationPartners,
-- src/hooks/useData.ts). Complétée (pas remplacée — le polling reste
-- volontairement actif en parallèle, voir useMessagingRealtime) par un
-- abonnement Supabase Realtime aux INSERT sur messages : pour qu'il
-- reçoive quoi que ce soit, la table doit d'abord être ajoutée à la
-- publication supabase_realtime (désactivée par défaut table par table).
-- Idempotent : ne fait rien si déjà fait (évite l'erreur "relation is
-- already member of publication").

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
