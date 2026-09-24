-- ============================================================
-- ANIMÉAUX — Un praticien peut désactiver la réception de messages
-- (25/09/2026)
-- ============================================================
-- Chaque praticien décide pour lui-même (pas un interrupteur global admin)
-- — certains préfèrent n'être contactés que par RDV. Appliqué via une
-- policy RESTRICTIVE (et non une simple vérification côté client) : les
-- policies restrictives se combinent en ET avec les policies permissives
-- existantes ("messages: envoyer", 001_schema.sql, auth.uid() = sender_id)
-- plutôt qu'en OU, donc elle RÉDUIT ce qui est permis sans avoir à
-- toucher/dupliquer la policy déjà en place.
-- ============================================================

alter table public.doctors
  add column if not exists messaging_enabled boolean not null default true;

create policy "messages: bloque l'envoi si le praticien a désactivé la messagerie"
on public.messages
as restrictive
for insert
with check (
  not exists (
    select 1 from public.doctors d
    where d.user_id = messages.receiver_id and d.messaging_enabled = false
  )
);

notify pgrst, 'reload schema';
