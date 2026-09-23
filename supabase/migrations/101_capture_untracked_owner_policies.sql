-- ============================================================
-- ANIMÉAUX — Capture 3 policies RLS non versionnées (23/09/2026)
-- ============================================================
-- En vérifiant l'accès propriétaire à care_items (ex-vaccines) après la
-- migration 100, on a découvert via `select * from pg_policies where
-- tablename = 'care_items'` qu'une policy "vaccines: via animal owner"
-- (FOR ALL, donc SELECT/INSERT/UPDATE/DELETE pour le propriétaire de
-- l'animal) existe bel et bien en prod — mais n'apparaît dans AUCUN
-- fichier de migration committé. Créée un jour directement dans le SQL
-- Editor, jamais reportée dans le repo. Même vérification faite sur
-- weight_tracking et health_records : exactement le même trou, une
-- policy "X: via animal owner" chacune, jamais committée non plus.
--
-- Rien n'est cassé aujourd'hui (ces policies tournent déjà et donnent
-- correctement accès aux propriétaires), mais c'est exactement le trou
-- qui a déjà fait perdre des tables entières lors d'un incident
-- plateforme (voir 039_recreate_incident_lost_tables.sql et
-- 081_animal_records_hardening_and_recovery.sql, tous deux nés du même
-- problème sur vaccines/weight_tracking/health_records/animals) : si une
-- de ces tables devait être reconstruite depuis les migrations seules,
-- la policy propriétaire serait silencieusement perdue et plus aucun
-- propriétaire ne verrait ses données.
--
-- Expressions exactes récupérées en direct via pg_policies.qual,
-- recréées à l'identique (aucun changement de comportement), juste
-- renommées pour suivre la convention "<table>: ..." déjà utilisée
-- partout ailleurs sur ces tables.
-- ============================================================

drop policy if exists "vaccines: via animal owner" on public.care_items;
drop policy if exists "care_items: propriétaire voit et ajoute" on public.care_items;
create policy "care_items: propriétaire voit et ajoute" on public.care_items for all
  using (exists (select 1 from public.animals where animals.id = care_items.animal_id and animals.owner_id = auth.uid()));

drop policy if exists "weight_tracking: via animal owner" on public.weight_tracking;
drop policy if exists "weight_tracking: propriétaire voit et ajoute" on public.weight_tracking;
create policy "weight_tracking: propriétaire voit et ajoute" on public.weight_tracking for all
  using (exists (select 1 from public.animals where animals.id = weight_tracking.animal_id and animals.owner_id = auth.uid()));

drop policy if exists "health_records: via animal owner" on public.health_records;
drop policy if exists "health_records: propriétaire voit et ajoute" on public.health_records;
create policy "health_records: propriétaire voit et ajoute" on public.health_records for all
  using (exists (select 1 from public.animals where animals.id = health_records.animal_id and animals.owner_id = auth.uid()));

notify pgrst, 'reload schema';
