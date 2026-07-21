// supabase/functions/invite-clinic-secretary/index.ts
// Cree un acces secretariat pour un cabinet : appelee par le proprietaire
// depuis le tableau de bord praticien. Le mot de passe est genere cote
// serveur (jamais choisi par la secretaire) et envoye par email a la
// secretaire, avec le proprietaire du cabinet en copie.
//
// Version sans accents et sans template literals imbriques : la version
// avec accents/emoji a echoue au deploiement depuis l'editeur Supabase
// (erreur de parsing probablement liee a une substitution de caracteres
// lors du copier-coller). Cette version ASCII est fonctionnellement
// identique et evite ce risque.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Appelee depuis le navigateur : le preflight CORS (OPTIONS) doit recevoir
// une reponse explicite avec ces headers, sinon le fetch echoue avant
// meme d'atteindre la logique ci-dessous ("Failed to send a request to
// the Edge Function" cote client).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generatePassword() {
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
      return new Response('Interdit', { status: 403, headers: corsHeaders })
    }

    // L'espace secretariat doit toujours etre un compte a part entiere,
    // avec ses propres identifiants (dashboard parallele au tableau de
    // bord praticien, jamais un lien ajoute a une session existante). Un
    // email deja utilise par un autre compte Animeaux est donc refuse
    // plutot que rattache a ce compte.
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Cette adresse email est deja utilisee par un autre compte Animeaux. Merci d\'utiliser une adresse email dediee pour l\'acces secretariat.' }),
        { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    const password = generatePassword()
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { role: 'secretary' },
    })
    if (createErr || !created || !created.user) {
      return new Response(
        JSON.stringify({ ok: false, error: (createErr && createErr.message) || 'Erreur lors de la creation du compte' }),
        { status: 500, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }
    const userId = created.user.id

    const { error: staffErr } = await supabaseAdmin
      .from('clinic_staff')
      .upsert({ clinic_id: clinicId, user_id: userId, invited_by: user.id }, { onConflict: 'clinic_id,user_id' })
    if (staffErr) {
      console.error('clinic_staff insert error', staffErr)
      return new Response(JSON.stringify({ ok: false, error: staffErr.message }), {
        status: 500,
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    let emailSent = false
    const loginUrl = (Deno.env.get('APP_URL') || 'https://anim-aux-a2qn.vercel.app') + '/login'

    if (resendKey) {
      const html = '<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">'
        + '<h2 style="color: #d9670b;">Acces a l espace cabinet</h2>'
        + '<p>Bonjour,</p>'
        + '<p>Un acces dedie au cabinet <strong>' + clinic.name + '</strong> vient d etre cree sur Animeaux.</p>'
        + '<ul style="line-height: 1.8;">'
        + '<li><strong>Email de connexion :</strong> ' + email + '</li>'
        + '<li><strong>Mot de passe :</strong> ' + password + '</li>'
        + '</ul>'
        + '<p><a href="' + loginUrl + '" style="color: #d9670b;">Se connecter a Animeaux</a></p>'
        + '<p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Le proprietaire du cabinet est en copie de cet email.</p>'
        + '</div>'

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('EMAIL_FROM') || 'Animeaux <onboarding@resend.dev>',
          to: email,
          cc: user.email ? [user.email] : undefined,
          subject: 'Vos acces a l espace cabinet ' + clinic.name,
          html: html,
        }),
      })
      emailSent = resendRes.ok
      if (!resendRes.ok) {
        console.error('Resend error', await resendRes.text())
      }
    }

    return new Response(JSON.stringify({ ok: true, emailSent: emailSent }), {
      headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
    })
  }
})
