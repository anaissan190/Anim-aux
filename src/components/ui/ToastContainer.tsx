// src/components/ui/ToastContainer.tsx
// Monté une seule fois dans App.tsx — affiche les messages empilés via
// showToast() (src/lib/toast.ts).
import { useEffect, useState } from 'react'
import { subscribeToast, type ToastItem } from '@/lib/toast'

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => subscribeToast(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none px-4">
      {toasts.map(t => (
        <div key={t.id}
          className="animate-toast-in bg-moss-700 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap">
          {t.message}
        </div>
      ))}
    </div>
  )
}
