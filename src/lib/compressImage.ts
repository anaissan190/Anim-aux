// src/lib/compressImage.ts
// Réduit une photo côté client avant envoi — une photo prise directement
// avec l'appareil d'un téléphone pèse souvent plusieurs Mo en pleine
// résolution alors qu'une vignette de profil n'a besoin que de quelques
// centaines de pixels de large, d'où l'envoi très lent constaté sur mobile
// (retour d'Anaïs du 08/09/2026 : "c'est finalement arrivé mais très
// longtemps après").

// Logique pure (testable sans Canvas/Image, indisponibles de façon fiable
// en environnement de test) — voir src/lib/doctorStats.ts pour le même
// principe d'extraction.
export function computeResizedDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function compressImage(file: File, maxDimension = 900, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = computeResizedDimensions(bitmap.width, bitmap.height, maxDimension)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    // Une image déjà petite/optimisée peut ressortir plus lourde après
    // ré-encodage JPEG — dans ce cas, autant garder l'original.
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    // Compression best-effort : un navigateur qui ne supporte pas
    // createImageBitmap ou un fichier corrompu ne doit pas bloquer l'envoi,
    // juste l'envoyer tel quel.
    return file
  }
}
