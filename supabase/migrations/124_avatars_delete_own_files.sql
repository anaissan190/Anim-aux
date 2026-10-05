-- 124_avatars_delete_own_files.sql
-- Le bucket "avatars" n'avait aucune policy DELETE (migration 004 : lecture, envoi,
-- remplacement seulement) : l'application ne pouvait pas supprimer l'ancienne photo
-- quand un utilisateur en change, ni celle d'un animal supprimé — les fichiers
-- s'accumulaient (24 orphelins constatés le 06/10/2026). Un utilisateur connecté
-- peut désormais supprimer ses PROPRES fichiers (owner = auth.uid()), comme c'est
-- déjà le cas pour le bucket "documents" (migration 025).
drop policy if exists "avatars: suppression de ses propres fichiers" on storage.objects;
create policy "avatars: suppression de ses propres fichiers" on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
