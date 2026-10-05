-- 117_storage_listing_lockdown.sql
-- Audit du 05/10/2026 : les policies "lecture publique" de storage.objects sur
-- les buckets "avatars" et "documents" (migrations 004 / 025) autorisaient
-- N'IMPORTE QUI — y compris sans compte, avec la clé publique du site — à LISTER
-- tous les fichiers via l'API Storage (/storage/v1/object/list/<bucket>), donc à
-- découvrir puis télécharger chaque document (ordonnances, comptes rendus,
-- photos). Vérifié en direct : 13 fichiers "documents" et 11 "avatars"
-- énumérables anonymement.
--
-- Les buckets restent PUBLICS : une URL publique (…/object/public/<bucket>/…),
-- celle que stocke l'application et que servent les <img>/liens, fonctionne
-- sans aucune policy. Seule l'énumération est fermée. On garde une lecture
-- limitée à SES PROPRES fichiers pour les utilisateurs connectés : elle est
-- nécessaire aux téléversements avec upsert (remplacement d'une photo), qui
-- exigent un droit de lecture sur l'objet existant.
--
-- Limite connue (étape suivante possible) : un document dont l'URL fuite reste
-- lisible par quiconque la possède. Le rendre réellement privé impose des URLs
-- signées partout où l'application affiche un document.
drop policy if exists "avatars: lecture publique" on storage.objects;
create policy "avatars: lecture de ses propres fichiers" on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "documents: lecture publique" on storage.objects;
create policy "documents: lecture de ses propres fichiers" on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
