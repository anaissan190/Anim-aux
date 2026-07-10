// src/components/ui/NotificationBell.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const qc = useQueryClient()
  const unread = notifications.filter(n => !n.is_read).length

  // Écoute temps réel des nouvelles notifications
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('notifications')
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
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-sm">Notifications</p>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Aucune notification</p>
              ) : notifications.map(n => (
                <div key={n.id}
                  onClick={() => { if (n.type === 'new_message') { setOpen(false); navigate('/messages') } }}
                  className={`px-4 py-3 text-sm ${n.is_read ? 'bg-white' : 'bg-sage-50'} ${n.type === 'new_message' ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
                  <p className="font-medium text-gray-900">{n.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
