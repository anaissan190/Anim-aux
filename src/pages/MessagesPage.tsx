// src/pages/MessagesPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import MobileHeader from '@/components/mobile/MobileHeader'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import { useConversation, useSendMessage, useConversationPartners, useMarkConversationRead, useMessagingRealtime } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

function hiddenKey(userId: string) { return `animeaux-hidden-conversations-${userId}` }
// user_id -> date ISO à laquelle la conversation a été masquée. Comparé à
// last_message_at pour la réafficher automatiquement dès qu'un nouveau
// message arrive après ce masquage — sans dépendre du temps réel (canal
// realtime), qui peut ne jamais se déclencher selon la config du projet.
type HiddenMap = Record<string, string>
function loadHidden(userId?: string | null): HiddenMap {
  if (!userId) return {}
  try {
    const raw = JSON.parse(localStorage.getItem(hiddenKey(userId)) ?? '{}')
    return Array.isArray(raw) ? {} : raw // ancien format (tableau) : on l'ignore
  } catch { return {} }
}
function saveHidden(userId: string, map: HiddenMap) {
  localStorage.setItem(hiddenKey(userId), JSON.stringify(map))
}

export default function MessagesPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  // Ouverture directe d'une conversation depuis une notification push
  // ('new_message', voir urlForNotificationType) : sans ça, le clic
  // retombait sur la conversation la plus récente, pas forcément celle
  // notifiée si plusieurs ont des messages non lus en même temps.
  const [searchParams] = useSearchParams()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get('with'))
  const [text, setText] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  // Cette page (recherche par nom d'animal, "prenez un RDV"...) est pensée
  // pour un propriétaire d'animal. Le praticien a sa propre expérience,
  // adaptée, dans l'onglet Messages de son dashboard — on l'y renvoie s'il
  // arrive ici quand même (ancien lien, favori...).
  useEffect(() => {
    if (user?.role === 'doctor') navigate('/dashboard/doctor?tab=messages', { replace: true })
  }, [user])

  const { data: messages = [] } = useConversation(selectedUserId ?? '')
  const send = useSendMessage()
  const { data: partners = [] } = useConversationPartners()
  const markRead = useMarkConversationRead()
  const [contactSearch, setContactSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [newMsgSearch, setNewMsgSearch] = useState('')
  // Conversations supprimées : une fois supprimée, un contact issu des RDV
  // (relation permanente) ne doit pas réapparaître tout seul dans le feed —
  // on le masque tant qu'aucun nouveau message n'est rééchangé avec lui.
  const [hiddenIds, setHiddenIds] = useState<HiddenMap>(() => loadHidden(user?.id))

  // La liste vient en priorité de get_conversation_partners() (construite
  // directement à partir des messages échangés — fiable, avec les noms
  // résolus), complétée par les contacts issus des RDV pour pouvoir démarrer
  // une conversation avec quelqu'un à qui on n'a encore jamais écrit.
  const sortedContacts = (() => {
    const byId = new Map<string, any>()
    partners.forEach(p => byId.set(p.user_id, {
      user_id: p.user_id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      lastAt: p.last_message_at,
      lastContent: p.last_message_content,
      unread: p.unread_count,
    }))
    contacts.forEach(c => { if (!byId.has(c.user_id)) byId.set(c.user_id, c) })
    return [...byId.values()]
      .filter(c => {
        const hiddenAt = hiddenIds[c.user_id]
        if (!hiddenAt) return true
        // Reste masqué tant qu'aucun message plus récent que le masquage
        // n'est arrivé (sinon il réapparaît tout seul, même sans que le
        // canal realtime ait notifié à temps).
        if (!c.lastAt) return false
        return new Date(c.lastAt).getTime() > new Date(hiddenAt).getTime()
      })
      .sort((a, b) => {
        if (!a.lastAt && !b.lastAt) return 0
        if (!a.lastAt) return 1
        if (!b.lastAt) return -1
        return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      })
  })()

  const filteredContacts = sortedContacts.filter((c: any) =>
    c.name.toLowerCase().includes(contactSearch.trim().toLowerCase())
  )

  // "Nouveau message" : uniquement les praticiens (ou patients, si praticien)
  // avec qui un rendez-vous a eu lieu — jamais une recherche ouverte sur
  // tous les profils.
  const newMsgResults = contacts.filter(c =>
    c.name.toLowerCase().includes(newMsgSearch.trim().toLowerCase())
  )

  // Masquage personnel uniquement : on ne touche jamais aux messages en base
  // (ils sont partagés avec l'autre personne). Supprimer une conversation
  // de son côté ne doit jamais faire disparaître l'historique chez l'autre.
  function handleDeleteConversation(otherUserId: string) {
    if (selectedUserId === otherUserId) setSelectedUserId(null)
    setConfirmDeleteId(null)
    if (user) {
      const next = { ...hiddenIds, [otherUserId]: new Date().toISOString() }
      setHiddenIds(next)
      saveHidden(user.id, next)
    }
  }

  // Renvoyer un message à un contact masqué (ou en recevoir un via le
  // realtime) le fait réapparaître immédiatement — sinon le filtre par date
  // s'en charge de toute façon dès le prochain rafraîchissement.
  function unhideContact(otherUserId: string) {
    if (!user || !(otherUserId in hiddenIds)) return
    const { [otherUserId]: _removed, ...rest } = hiddenIds
    setHiddenIds(rest)
    saveHidden(user.id, rest)
  }

  // Marque la conversation comme lue dès qu'on l'ouvre
  useEffect(() => {
    if (selectedUserId) markRead.mutate(selectedUserId)
  }, [selectedUserId])

  // Charge les contacts depuis les RDV existants
  useEffect(() => {
    if (!user) return
    async function loadContacts() {
      if (user!.role === 'patient') {
        const { data, error } = await supabase
          .from('appointments')
          .select('doctor_id, doctors!inner(profiles!inner(first_name, last_name, user_id))')
          .eq('patient_id', user!.id)
        if (error) { console.error('loadContacts', error); return }
        const seen = new Set<string>()
        const list: any[] = []
        ;(data ?? []).forEach((a: any) => {
          const p = a.doctors?.profiles
          if (p && !seen.has(p.user_id)) {
            seen.add(p.user_id)
            list.push({ user_id: p.user_id, name: `${p.first_name} ${p.last_name}` })
          }
        })
        setContacts(list)
        return
      }

      // Côté praticien : "profiles!patient_id(...)" n'est pas un embed
      // PostgREST valide (appointments.patient_id référence users, pas
      // profiles) — et même en repassant par users, aucune policy RLS ne
      // permet à un praticien de lire la ligne users d'un patient (même
      // constat que DoctorDashboard.tsx, voir son commentaire équivalent).
      // Requête en deux temps : patient_ids depuis appointments, puis
      // profiles directement (policy RLS dédiée qui, elle, l'autorise).
      const doctorRow = await supabase.from('doctors').select('id').eq('user_id', user!.id).single()
      const { data: appts, error: apptsErr } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', doctorRow.data?.id)
      if (apptsErr) { console.error('loadContacts', apptsErr); return }
      const patientIds = [...new Set((appts ?? []).map((a: any) => a.patient_id))]
      if (patientIds.length === 0) { setContacts([]); return }
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', patientIds)
      if (profilesErr) { console.error('loadContacts', profilesErr); return }
      setContacts((profilesData ?? []).map((p: any) => ({ user_id: p.user_id, name: `${p.first_name} ${p.last_name}` })))
    }
    loadContacts()
  }, [user])

  // Sélectionne la première conversation par défaut (priorité à celle avec
  // l'activité la plus récente, une fois les données chargées).
  useEffect(() => {
    if (!selectedUserId && sortedContacts.length > 0) setSelectedUserId(sortedContacts[0].user_id)
  }, [sortedContacts.length])

  // Realtime messages : écoute même sans conversation ouverte pour mettre
  // à jour la liste (tri + badge non-lus) dès qu'un message arrive. Logique
  // partagée avec DoctorDashboard.tsx, voir useMessagingRealtime.
  useMessagingRealtime(user?.id, 'msgs', unhideContact)

  // Scroll au dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selectedUserId) return
    await send.mutateAsync({ receiverId: selectedUserId, content: text.trim() })
    unhideContact(selectedUserId)
    setText('')
  }

  // Le praticien est redirigé vers son propre onglet Messages (useEffect
  // ci-dessus) ; on n'affiche rien ici le temps que la redirection s'exécute.
  if (user?.role === 'doctor') return null

  const isPatient = user?.role === 'patient'

  return (
    <div className="min-h-screen bg-[#FFFAF0] flex flex-col">
      {/* Sur mobile, seul le rôle patient bascule vers la nouvelle coquille
          "Wow / Aurora" — les autres rôles (admin/secrétariat) gardent
          Navbar/BackButton classiques à toutes les largeurs. */}
      {isPatient ? (
        <div className="hidden md:block">
          <Navbar />
          <div className="max-w-5xl w-full mx-auto px-4 pt-6 flex-shrink-0">
            <BackButton fallback="/dashboard/patient" />
          </div>
        </div>
      ) : (
        <>
          <Navbar />
          <div className="max-w-5xl w-full mx-auto px-4 pt-6 flex-shrink-0">
            <BackButton fallback="/dashboard/patient" />
          </div>
        </>
      )}

      {isPatient && (
        <div className="md:hidden">
          <MobileHeader className="bg-sage-100/60">
            <h1 className="font-fredoka text-2xl font-semibold text-gray-900">Messages</h1>
            <p className="font-nunito text-sm text-gray-500 mt-0.5">Avec les praticiens</p>
          </MobileHeader>
        </div>
      )}

      <div className={`flex-1 min-h-0 max-w-5xl w-full mx-auto px-4 flex gap-4 ${isPatient ? 'pb-24 md:pb-6' : 'pb-6'}`}>

        {/* Liste contacts — sur mobile, la liste et la conversation ouverte
            s'affichent l'une à la fois (comme une vraie appli de messagerie)
            plutôt que compressées côte à côte ; desktop inchangé. */}
        <aside className={`w-full md:w-64 flex-shrink-0 card overflow-y-auto ${selectedUserId ? 'hidden md:block' : ''}`}>
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">Conversations</p>
              <button onClick={() => { setShowNewMsg(true); setNewMsgSearch('') }}
                className="text-xs bg-sage-500 text-white px-3 py-1.5 rounded-lg hover:bg-sage-600 transition-colors">
                + Nouveau
              </button>
            </div>
            <input
              type="text"
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              placeholder="Rechercher..."
              className="input text-xs py-1.5"
            />
          </div>

          {/* Recherche nouveau message — limitée aux contacts avec RDV */}
          {showNewMsg && (
            <div className="p-3 border-b border-gray-100 bg-sage-50">
              <p className="text-xs font-medium text-gray-600 mb-2">Nouveau message</p>
              <input
                className="input text-sm w-full"
                placeholder="Rechercher parmi vos praticiens..."
                value={newMsgSearch}
                onChange={e => setNewMsgSearch(e.target.value)}
                autoFocus
              />
              {newMsgResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                  {newMsgResults.map(r => (
                    <button key={r.user_id}
                      onClick={() => {
                        setSelectedUserId(r.user_id)
                        unhideContact(r.user_id)
                        setShowNewMsg(false)
                        setNewMsgSearch('')
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors text-sm">
                      <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center text-xs text-sage-700 font-bold flex-shrink-0">
                        {r.name[0]}
                      </div>
                      <span className="text-gray-700">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {newMsgResults.length === 0 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {contacts.length === 0
                    ? "Vous n'avez pas encore eu de rendez-vous avec un praticien."
                    : 'Aucun résultat.'}
                </p>
              )}
              <button onClick={() => setShowNewMsg(false)}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2 w-full text-center">
                Annuler
              </button>
            </div>
          )}

          {sortedContacts.length === 0 ? (
            <p className="text-xs text-gray-400 p-4 text-center">Aucune conversation — prenez un RDV pour commencer à échanger.</p>
          ) : filteredContacts.length === 0 ? (
            <p className="text-xs text-gray-400 p-4 text-center">Aucun résultat.</p>
          ) : filteredContacts.map((c: any) => (
            <div key={c.user_id}
              className={`group w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer
                ${selectedUserId === c.user_id ? 'bg-sage-50' : ''}`}
              onClick={() => setSelectedUserId(c.user_id)}>
              <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-xs text-sage-700 font-bold flex-shrink-0">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${c.unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{c.name}</p>
                {c.lastContent && (
                  <p className={`text-xs truncate ${c.unread > 0 ? 'text-gray-600' : 'text-gray-400'}`}>{c.lastContent}</p>
                )}
              </div>
              {c.unread > 0 && (
                <span className="flex-shrink-0 w-5 h-5 bg-sage-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {c.unread > 9 ? '9+' : c.unread}
                </span>
              )}
              {confirmDeleteId === c.user_id ? (
                <span className="flex-shrink-0 flex flex-col items-end gap-0.5 text-xs">
                  <button onClick={e => { e.stopPropagation(); handleDeleteConversation(c.user_id) }}
                    className="text-red-500 hover:underline font-semibold">Supprimer</button>
                  <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                    className="text-gray-400 hover:underline">Annuler</button>
                </span>
              ) : (
                <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.user_id) }}
                  className="flex-shrink-0 text-xs text-gray-400 hover:text-red-500 hover:underline transition-colors"
                  title="Supprimer la conversation">
                  Suppr.
                </button>
              )}
            </div>
          ))}
        </aside>

        {/* Zone de chat */}
        <div className={`w-full flex-1 card flex-col overflow-hidden ${selectedUserId ? 'flex' : 'hidden md:flex'}`}>
          {!selectedUserId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex-shrink-0 flex items-center gap-2">
                <button onClick={() => setSelectedUserId(null)} className="md:hidden text-gray-400 hover:text-gray-600 -ml-1 p-1">
                  ←
                </button>
                <p className="font-semibold text-sm text-gray-900">
                  {sortedContacts.find((c: any) => c.user_id === selectedUserId)?.name}
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                  const mine = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm
                        ${mine
                          ? 'bg-sage-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        <p>{m.content}</p>
                        <p className={`text-xs mt-1 ${mine ? 'text-sage-200' : 'text-gray-400'}`}>
                          {format(new Date(m.created_at), 'HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
                <input value={text} onChange={e => setText(e.target.value)}
                  placeholder="Votre message..." className="input flex-1" />
                <button type="submit" disabled={!text.trim() || send.isPending}
                  className="btn-primary px-5">
                  Envoyer
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      {isPatient && <MobileTabBar />}
    </div>
  )
}
