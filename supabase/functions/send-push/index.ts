// supabase/functions/send-push/index.ts
// Appelée par le trigger notify_push_on_new_notification (migration 068) à
// chaque insertion dans `notifications` — donc pour toute notification
// déjà existante dans l'app (RDV confirmé/annulé, nouveau message, avis,
// liste d'attente, rappel de vaccin...), sans avoir à modifier chacun de
// leurs points d'insertion. Best-effort : un abonnement expiré ne doit
// jamais faire échouer l'insertion de la notification elle-même (déjà
// garanti côté trigger, qui l'appelle en fire-and-forget via pg_net).

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@monanimeaux.fr',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

Deno.serve(async (req) => {
  let notificationId: string | undefined
  try {
    ({ notification_id: notificationId } = await req.json())
  } catch {
    return new Response('Corps JSON invalide', { status: 400 })
  }
  if (!notificationId) return new Response('notification_id manquant', { status: 400 })

  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .select('user_id, title, body, type, related_id')
    .eq('id', notificationId)
    .single()
  if (notifError || !notification) {
    return new Response('Notification introuvable', { status: 404 })
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id)

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    type: notification.type,
    related_id: notification.related_id,
  })

  let sent = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err: any) {
      // Abonnement révoqué/expiré côté navigateur (410 Gone, ou 404 si le
      // service push l'a déjà oublié) : on le supprime pour ne pas
      // continuer à essayer indéfiniment sur un endpoint mort.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
