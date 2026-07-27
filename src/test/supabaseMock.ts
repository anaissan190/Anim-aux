// src/test/supabaseMock.ts
// Mock réutilisable du client Supabase pour tester les hooks de
// src/hooks/useData.ts sans réseau. supabase-js expose une API "builder"
// chaînable (chaque méthode renvoie `this`) qui se termine par un await —
// on reproduit ça avec un objet où chaque méthode de filtre renvoie le
// builder lui-même, et qui est "thenable" (résout la valeur finale quand
// on l'await), exactement comme le vrai client.
import { vi } from 'vitest'

export interface SupabaseMockResult {
  data: any
  error: any
}

const DEFAULT_RESULT: SupabaseMockResult = { data: null, error: null }

export function createQueryBuilderMock(result: SupabaseMockResult = DEFAULT_RESULT) {
  const builder: any = {}
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'in', 'not', 'is', 'or', 'gt', 'gte', 'lt', 'lte',
    'order', 'limit', 'range',
  ]
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Le vrai query builder est thenable : `await supabase.from(...).select()...`
  // fonctionne sans .single()/.maybeSingle() explicite si la requête renvoie
  // directement une liste.
  builder.then = (resolve: (r: SupabaseMockResult) => void, reject?: (e: any) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

export function createSupabaseMock() {
  return {
    from: vi.fn(() => createQueryBuilderMock()),
    rpc: vi.fn(() => Promise.resolve(DEFAULT_RESULT)),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn(function (this: any) { return this }),
      subscribe: vi.fn(function (this: any) { return this }),
    })),
    removeChannel: vi.fn(),
  }
}
