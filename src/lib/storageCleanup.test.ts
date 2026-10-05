import { describe, it, expect, vi, beforeEach } from 'vitest'

const remove = vi.fn()
vi.mock('./supabase', () => ({ supabase: { storage: { from: vi.fn(() => ({ remove })) } } }))

import { supabase } from './supabase'
import { removeStoredFiles } from './storageCleanup'

const BASE = 'https://abc.supabase.co/storage/v1/object/public'

beforeEach(() => { vi.clearAllMocks(); remove.mockResolvedValue({ data: [], error: null }) })

describe('removeStoredFiles', () => {
  it('supprime chaque fichier dans son bucket', async () => {
    await removeStoredFiles([`${BASE}/avatars/animals/a1.jpeg`, `${BASE}/documents/animals/d1.pdf`])
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars')
    expect(supabase.storage.from).toHaveBeenCalledWith('documents')
    expect(remove).toHaveBeenCalledWith(['animals/a1.jpeg'])
    expect(remove).toHaveBeenCalledWith(['animals/d1.pdf'])
  })
  it("n'appelle pas Storage s'il n'y a rien à supprimer", async () => {
    await removeStoredFiles([undefined, 'https://exemple.fr/x.jpg'])
    expect(supabase.storage.from).not.toHaveBeenCalled()
  })
  it("n'échoue jamais, même si Storage plante", async () => {
    remove.mockRejectedValue(new Error('réseau'))
    await expect(removeStoredFiles([`${BASE}/avatars/animals/a1.jpeg`])).resolves.toBeUndefined()
  })
})
