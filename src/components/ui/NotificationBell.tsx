// src/components/ui/NotificationBell.tsx
import { useState, useEffect } from 'react'
import { useNotifications, useMarkNotificationsRead, useDeleteNotification, useDeleteAllNotifications } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { user } = useAuthStore()
  const { data: allNotifications = [] } = useNotifications()
  // Les nouveaux messages ont désormais leur propre indicateur (pastille
  // rouge sur l'icône enveloppe, voir Navbar.tsx) : la cloche ne sert plus
  // qu'aux autres mises à jour (RDV confirmé/annulé, nouvel avis, etc.).
  const notifications = allNotifications.filter(n => n.type !== 'new_message')
  const markRead = useMarkNotificationsRead()
  const deleteNotification = useDeleteNotification()
  const deleteAllNotifications = useDeleteAllNotifications()
  const qc = useQueryClient()
  const unread = notifications.filter(n => !n.is_read).length

  // Écoute temps réel des nouvelles notifications. Le nom du canal inclut
  // l'id utilisateur : ce composant est désormais monté deux fois en
  // parallèle (Navbar desktop + MobileHeader mobile, basculées en CSS) —
  // un nom de canal fixe ferait échouer le second useEffect (Supabase
  // refuse deux abonnements simultanés au même nom de canal).
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel(`notifications-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => qc.invalidateQueries({ queryKey: ['notifications'] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  function handleOpen() {
    setOpen(!open)
    if (!open && unread > 0) markRead.mutate()
  }

  return (
    <div className="relative">
      <button onClick={handleOpen} className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 card shadow-xl z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-sm">Notifications</p>
              {notifications.length > 0 && (
                <button
                  onClick={() => deleteAllNotifications.mutate()}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  Tout effacer
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Aucune notification</p>
              ) : notifications.map(n => (
                <div key={n.id}
                  className={`px-4 py-3 text-sm flex items-start gap-2 ${n.is_read ? 'bg-white' : 'bg-sage-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNotification.mutate(n.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                    title="Supprimer">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
