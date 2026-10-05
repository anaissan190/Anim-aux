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
