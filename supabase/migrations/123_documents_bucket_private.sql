-- 123_documents_bucket_private.sql  (ÉTAPE 2 sur 2 — à lancer SEULEMENT après la 122
-- et après avoir vérifié que les documents s'ouvrent encore via les liens signés)
-- Rend le bucket "documents" privé : une URL publique stockée en base cesse de
-- fonctionner pour quiconque n'est pas autorisé ; l'application passe par des
-- liens temporaires signés (useSignedDocumentUrls). Les ordonnances et comptes
-- rendus ne sont plus lisibles par simple connaissance de leur adresse.
--
-- Retour arrière immédiat si un document ne s'ouvre plus :
--   update storage.buckets set public = true where id = 'documents';
update storage.buckets set public = false where id = 'documents';
