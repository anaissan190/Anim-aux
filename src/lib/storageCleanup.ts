// src/lib/storageCleanup.ts
// Suppression « au mieux » des fichiers de stockage devenus inutiles. Ne jette
// JAMAIS d'erreur : l'action de l'utilisateur (supprimer un document, changer de
// photo) a déjà réussi côté base, un fichier qui résiste ne doit pas la faire
// échouer — il sera simplement rattrapé par un nettoyage ultérieur.
import { supabase } from './supabase'
import { groupFilesByBucket } from './storageUrls'

export async function removeStoredFiles(urls: (string | null | undefined)[]): Promise<void> {
  const grouped = groupFilesByBucket(urls)
  for (const bucket of ['avatars', 'documents'] as const) {
    const paths = grouped[bucket]
    if (paths.length === 0) continue
    try {
      await supabase.storage.from(bucket).remove(paths)
    } catch (e) {
      console.warn(`removeStoredFiles(${bucket}) ignoré`, e)
    }
  }
}
