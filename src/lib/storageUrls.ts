// src/lib/storageUrls.ts
// Les documents des animaux et des rendez-vous (bucket "documents") étaient
// stockés avec leur URL PUBLIQUE ("…/storage/v1/object/public/documents/<chemin>").
// Pour rendre le bucket privé sans toucher aux lignes existantes en base, on
// retrouve le chemin de stockage depuis cette URL et on demande un lien
// temporaire signé au moment de l'affichage (voir useSignedDocumentUrls).

// Chemin de stockage dans le bucket "documents", ou null si l'URL n'en vient pas.
// Accepte une URL publique, une URL signée, ou déjà un chemin brut.
export function documentStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null
  if (!/^https?:\/\//i.test(fileUrl)) return fileUrl
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/documents\/([^?#]+)/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export type StorageBucket = 'avatars' | 'documents'

// Dossier de stockage + chemin d'un fichier à partir de son URL (publique ou
// signée) ; null pour tout ce qui ne vient pas de nos deux buckets applicatifs.
// Sert à supprimer le fichier réel quand l'application supprime la ligne qui le
// référence (document, photo remplacée, animal) : sans cela, le fichier restait
// indéfiniment dans le stockage (constaté le 06/10/2026 : 24 fichiers orphelins).
export function storageLocationFromUrl(fileUrl: string | null | undefined): { bucket: StorageBucket; path: string } | null {
  if (!fileUrl) return null
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/(avatars|documents)\/([^?#]+)/)
  if (!match) return null
  let path = match[2]
  try { path = decodeURIComponent(path) } catch { /* chemin brut conservé */ }
  return { bucket: match[1] as StorageBucket, path }
}

// Regroupe des URLs par bucket (doublons et URLs étrangères écartés).
export function groupFilesByBucket(urls: (string | null | undefined)[]): Record<StorageBucket, string[]> {
  const grouped: Record<StorageBucket, Set<string>> = { avatars: new Set(), documents: new Set() }
  for (const url of urls) {
    const loc = storageLocationFromUrl(url)
    if (loc) grouped[loc.bucket].add(loc.path)
  }
  return { avatars: [...grouped.avatars], documents: [...grouped.documents] }
}
