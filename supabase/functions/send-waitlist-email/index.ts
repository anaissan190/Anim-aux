// supabase/functions/send-waitlist-email/index.ts
// Appelée par le trigger notify_email_on_waitlist_notification (migration
// 071) à chaque notification de type 'waitlist_slot_available' — un
// créneau vient de se libérer chez un praticien pour lequel le patient
// s'était inscrit en liste d'attente. Complément à la notification in-app
// et au push déjà en place : tout le monde n'a pas activé les
// notifications push, mais quasiment tout le monde consulte ses emails.
// Best-effort : ne doit jamais faire échouer la notification elle-même
// (déjà garanti côté trigger, en fire-and-forget via pg_net).

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
    .select('user_id, title, body')
    .eq('id', notificationId)
    .single()
  if (notifError || !notification) {
    return new Response('Notification introuvable', { status: 404 })
  }

  const { data: recipient } = await supabase
    .from('users')
    .select('email')
    .eq('id', notification.user_id)
    .single()

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey || !recipient?.email) {
    return new Response(JSON.stringify({ sent: false }), { headers: { 'Content-Type': 'application/json' } })
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #d9670b;">${notification.title} 🐾</h2>
      <p>${notification.body}</p>
      <p style="margin-top: 20px;">
        <a href="https://monanimeaux.fr/search" style="background: #d9670b; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 500;">
          Voir les disponibilités
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
    </div>
  `

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'Animéaux <onboarding@resend.dev>',
      to: recipient.email,
      subject: notification.title,
      html,
    }),
  })
  if (!resendRes.ok) {
    console.error('Resend error', await resendRes.text())
  }

  return new Response(JSON.stringify({ sent: resendRes.ok }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
