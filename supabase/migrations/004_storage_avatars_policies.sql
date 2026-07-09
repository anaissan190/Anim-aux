-- ============================================================
-- ANIMÉAUX — Politiques de stockage pour le bucket "avatars"
-- Constaté le 09/07/2026 : aucune politique RLS n'existe sur
-- storage.objects, donc aucun envoi de fichier (photo animal,
-- photo de profil...) n'est autorisé, même si le bucket est
-- public en lecture. À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- Lecture publique des fichiers du bucket avatars (photos de profil/animaux)
drop policy if exists "avatars: lecture publique" on storage.objects;
create policy "avatars: lecture publique" on storage.objects for select
  using (bucket_id = 'avatars');

-- Les utilisateurs connectés peuvent envoyer des fichiers dans avatars
drop policy if exists "avatars: envoi par utilisateur connecté" on storage.objects;
create policy "avatars: envoi par utilisateur connecté" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

-- Les utilisateurs connectés peuvent remplacer un fichier existant (upsert)
drop policy if exists "avatars: remplacement par utilisateur connecté" on storage.objects;
create policy "avatars: remplacement par utilisateur connecté" on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');
