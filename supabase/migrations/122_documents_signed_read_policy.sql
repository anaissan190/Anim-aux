-- 122_documents_signed_read_policy.sql  (ÉTAPE 1 sur 2 — additive, sans risque)
-- Prépare le passage du bucket "documents" en privé : pour qu'un utilisateur
-- puisse obtenir un lien signé (createSignedUrl), il lui faut le droit SELECT
-- sur l'objet. On autorise la lecture d'un fichier à :
--   * son déposant (owner = auth.uid()) ;
--   * toute personne qui peut VOIR la ligne qui le référence, dans
--     animal_documents ou appointment_documents. Ces deux tables ont déjà
--     leurs propres règles d'accès (propriétaire de l'animal, praticien avec un
--     lien de soin valide — migration 116 —, patient/praticien du rendez-vous) ;
--     la sous-requête s'exécute avec les droits de l'appelant, donc ces règles
--     s'appliquent automatiquement et il n'y a rien à dupliquer.
-- Les fichiers sont référencés par leur URL publique (…/documents/<chemin>) :
-- on compare donc la FIN de l'URL au nom exact de l'objet.
drop policy if exists "documents: lecture de ses propres fichiers" on storage.objects;
drop policy if exists "documents: lecture autorisée" on storage.objects;
create policy "documents: lecture autorisée" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.animal_documents d
        where right(d.file_url, length(objects.name) + 1) = '/' || objects.name
      )
      or exists (
        select 1 from public.appointment_documents d
        where right(d.file_url, length(objects.name) + 1) = '/' || objects.name
      )
    )
  );
