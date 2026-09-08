// src/lib/toast.ts
// Message de confirmation qui glisse puis disparaît tout seul — retour
// d'Anaïs du 08/09/2026 sur l'aperçu de micro-interactions. Store minimal
// (pub-sub) plutôt qu'une dépendance externe, un seul ToastContainer monté
// dans App.tsx affiche ce que showToast() empile ici.
export interface ToastItem { id: number; message: string }

let toasts: ToastItem[] = []
let listeners: ((toasts: ToastItem[]) => void)[] = []
let nextId = 0

function notify() {
  listeners.forEach(l => l(toasts))
}

export function showToast(message: string) {
  const id = nextId++
  toasts = [...toasts, { id, message }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    notify()
  }, 2500)
}

export function subscribeToast(listener: (toasts: ToastItem[]) => void) {
  listeners.push(listener)
  return () => { listeners = listeners.filter(l => l !== listener) }
}
