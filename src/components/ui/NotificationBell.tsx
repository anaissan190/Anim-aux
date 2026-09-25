// src/components/ui/NotificationBell.tsx
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkNotificationsRead, useDeleteNotification, useDeleteAllNotifications } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

// Contrairement au service worker (urlForNotificationType, pushNotifications.ts)
// qui ne connaît pas le rôle du destinataire et doit rester prudent (retombe
// sur "/"), ce composant tourne dans l'app authentifiée : le rôle est connu,
// donc on peut choisir la bonne destination par rôle plutôt que de risquer
// d'envoyer un praticien sur "/rendez-vous" (route patient uniquement,
// bloquée par ProtectedRoute) — appointment_rescheduled par exemple est
// envoyé aussi bien au patient qu'au praticien selon qui a déplacé le RDV
// (voir migrations 077 et 083_patient_reschedule.sql). Fonction pure
// extraite (même principe que urlForNotificationType) pour être testable
// sans monter le composant.
const APPOINTMENT_TYPES = ['appointment_confirmed', 'appointment_cancelled', 'appointment_rescheduled', 'appointment_reminder']

export function destinationForNotification(type: string, relatedId: string | null, isDoctor: boolean): string | null {
  if (APPOINTMENT_TYPES.includes(type)) {
    return isDoctor ? '/dashboard/doctor?tab=disponibilites' : '/rendez-vous'
  }
  if ((type === 'review_reminder' || type === 'waitlist_slot_available') && relatedId) {
    return `/doctor/${relatedId}`
  }
  // vaccine_reminder gardé pour les notifications déjà en base avant la
  // généralisation vaccines -> care_items (23/09/2026, voir migration
  // 100) ; care_reminder est le type utilisé pour tout nouveau rappel
  // (vaccin, vermifuge, bilan annuel...).
  if ((type === 'vaccine_reminder' || type === 'care_reminder') && relatedId) {
    return `/animal/${relatedId}`
  }
  // Partage de dossier entre praticiens (migration 105) : related_id
  // porte animal_id (pas l'id de la ligne animal_referrals) pour les 4
  // types — propriétaire (demande reçue) comme médecin référent (réponse
  // reçue) atterrissent tous les deux sur la même fiche animal.
  if ((type === 'referral_requested' || type === 'referral_accepted' || type === 'referral_declined' || type === 'referral_revoked') && relatedId) {
    return `/animal/${relatedId}`
  }
  // Relance patients inactifs (migration 108) : pas de related_id (pas de
  // praticien/animal précis à recommander), renvoie directement vers la
  // recherche pour reprendre RDV.
  if (type === 'reengagement_reminder') {
    return '/search'
  }
  if (type === 'doctor_verified' || type === 'doctor_rejected') {
    return '/dashboard/doctor'
  }
  if (type === 'doctor_document_submitted') {
    // AdminDashboard s'ouvre par défaut sur l'onglet "En attente"
    // (useState<Tab>('pending')) — pas besoin d'un paramètre d'URL dédié.
    return '/dashboard/admin'
  }
  return null
}

export default function NotificationBell({ large = false }: { large?: boolean }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
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

  function handleNotificationClick(n: { type: string; related_id: string | null }) {
    const dest = destinationForNotification(n.type, n.related_id, user?.role === 'doctor')
    if (dest) {
      setOpen(false)
      navigate(dest)
    }
  }

  return (
    <div className="relative">
      <button onClick={handleOpen} data-tour="notifications" className={`relative rounded-xl hover:bg-gray-50 transition-colors ${large ? 'p-[8.5px] text-[21px] leading-none' : 'p-2'}`}>
        {large ? '🔔' : (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )}
        {unread > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full flex items-center justify-center font-medium animate-badge-pulse ${large ? 'w-[15px] h-[15px] text-[9px]' : 'w-4 h-4 text-xs'}`}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        // Rendu directement dans <body> (portal), pas à l'endroit où
        // <NotificationBell> est monté dans l'arbre React : un simple
        // "fixed" ne suffit pas dès qu'un ancêtre (animation de page,
        // transform CSS...) redéfinit son propre référentiel de
        // positionnement — le panneau se retrouvait écrasé en une bande
        // verticale de quelques pixels dans la coquille mobile "Aurora"
        // (signalé par Anaïs le 23/09/2026, absent de la Navbar desktop où
        // le bug avait d'abord semblé corrigé). Un portal échappe à tout
        // ancêtre, quel que soit l'endroit d'où la cloche est appelée.
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-4 right-4 top-16 md:left-auto md:right-4 md:w-80 card shadow-xl z-50 overflow-hidden">
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
                  onClick={() => handleNotificationClick(n)}
                  className={`px-4 py-3 text-sm flex items-start gap-2 ${n.is_read ? 'bg-white' : 'bg-sage-50'} ${destinationForNotification(n.type, n.related_id, user?.role === 'doctor') ? 'cursor-pointer hover:bg-sage-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNotification.mutate(n.id) }}
                    className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                    title="Supprimer">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
