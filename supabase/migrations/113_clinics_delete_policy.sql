-- 113_clinics_delete_policy.sql
-- Fermeture de cabinet (migration 112) : la policy "clinics: owner supprime"
-- prévue par la migration 039 n'existait PAS en production (vérifié via
-- pg_policies le 05/10/2026 : seules INSERT, UPDATE et SELECT étaient
-- présentes). Un delete direct était donc refusé par RLS sans la moindre
-- erreur (0 ligne supprimée) — l'écran annonçait une fermeture qui n'avait
-- jamais eu lieu. Même écart "migration committée / base réelle" que
-- pour les policies propriétaire de care_items/weight_tracking (migration 101).
drop policy if exists "clinics: owner supprime" on public.clinics;
create policy "clinics: owner supprime" on public.clinics
  for delete using (owner_id = auth.uid());
