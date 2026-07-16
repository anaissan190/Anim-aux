// supabase/functions/invite-clinic-secretary/index.ts
// Appelée par le propriétaire d'un cabinet depuis le tableau de bord
// praticien (onglet Disponibilités > Partagées > Secrétariat) pour créer
// un accès dédié à sa secrétaire. Le mot de passe est généré côté serveur
// (jamais choisi par la secrétaire) et envoyé par email à la secrétaire,
// avec le propriétaire du cabinet en copie — accès traçable au niveau du
// cabinet, pas un compte privé.
//
// auth.admin.createUser nécessite la clé service-role : c'est la seule
// façon de créer un compte pour quelqu'un d'autre que soi-même (supabase.
// auth.signUp ouvrirait une session pour ce nouveau compte à la place de
// l'appelant). Suit le même schéma que send-appointment-confirmation :
// client service-role, vérification du JWT appelant, action privilégiée,
// email best-effort via Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Appelée depuis le navigateur (pas juste server-to-server comme
// send-reminders) : le préflight CORS (OPTIONS) doit recevoir une réponse
// explicite, sinon le fetch échoue avant même d'atteindre la logique
// ci-dessous — c'est ce qui causait "Failed to send a request to the
// Edge Function" côté client.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generatePassword(): string {
  // Évite les caractères ambigus (0/O, 1/l/I) pour rester lisible dans un email.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { clinicId, email } = await req.json()
    if (!clinicId || !email) {
      return new Response('clinicId et email requis', { status: 400, headers: corsHeaders })
    }

    const { data: clinic, error: clinicErr } = await supabaseAdmin
      .from('clinics')
      .select('id, name, owner_id')
      .eq('id', clinicId)
      .single()
    if (clinicErr || !clinic) {
      return new Response('Cabinet introuvable', { status: 404, headers: corsHeaders })
    }
    if (clinic.owner_id !== user.id) {
      return new Response('Interdit : seul le propriétaire du cabinet peut inviter une secrétaire', { status: 403, headers: corsHeaders })
    }

    const password = generatePassword()
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'secretary' },
    })
    if (createErr || !created?.user) {
      const alreadyExists = createErr?.message?.toLowerCase().includes('already been registered')
      return new Response(
        JSON.stringify({ ok: false, error: alreadyExists ? 'Cet email est déjà utilisé par un compte existant.' : (createErr?.message ?? 'Erreur lors de la création du compte') }),
        { status: alreadyExists ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: staffErr } = await supabaseAdmin
      .from('clinic_staff')
      .insert({ clinic_id: clinicId, user_id: created.user.id, invited_by: user.id })
    if (staffErr) {
      // Compte déjà créé à ce stade : on ne le supprime pas (l'admin peut
      // réessayer l'email depuis Supabase si besoin), mais on remonte l'erreur.
      console.error('clinic_staff insert error', staffErr)
      return new Response(JSON.stringify({ ok: false, error: staffErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    let emailSent = false
    const loginUrl = `${Deno.env.get('APP_URL') ?? 'https://anim-aux-a2qn.vercel.app'}/login`

    if (resendKey) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #d9670b;">Accès à l'espace cabinet 🐾</h2>
          <p>Bonjour,</p>
          <p>Un accès dédié au cabinet <strong>${clinic.name}</strong> vient d'être créé sur Animéaux.</p>
          <ul style="line-height: 1.8;">
            <li><strong>Email de connexion :</strong> ${email}</li>
            <li><strong>Mot de passe :</strong> ${password}</li>
          </ul>
          <p><a href="${loginUrl}" style="color: #d9670b;">Se connecter à Animéaux</a></p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Le propriétaire du cabinet est en copie de cet email et peut révoquer cet accès à tout moment depuis son tableau de bord.</p>
          <p style="color: #6b7280; font-size: 13px;">Animéaux — Votre animal, notre priorité.</p>
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
          to: email,
          cc: user.email ? [user.email] : undefined,
          subject: `Vos accès à l'espace cabinet ${clinic.name}`,
          html,
        }),
      })
      emailSent = resendRes.ok
      if (!resendRes.ok) {
        console.error('Resend error', await resendRes.text())
      }
    }

    return new Response(JSON.stringify({ ok: true, emailSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
