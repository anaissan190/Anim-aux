// src/pages/MessagesPage.tsx
import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import { useConversation, useSendMessage, useConversationPartners, useMarkConversationRead, useDeleteConversation } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export default function MessagesPage() {
  const { user, profile } = useAuthStore()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: messages = [] } = useConversation(selectedUserId ?? '')
  const send = useSendMessage()
  const { data: partners = [] } = useConversationPartners()
  const markRead = useMarkConversationRead()
  const deleteConversation = useDeleteConversation()
  const [contactSearch, setContactSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
    return [...byId.values()].sort((a, b) => {
      if (!a.lastAt && !b.lastAt) return 0
      if (!a.lastAt) return 1
      if (!b.lastAt) return -1
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    })
  })()

  const filteredContacts = sortedContacts.filter((c: any) =>
    c.name.toLowerCase().includes(contactSearch.trim().toLowerCase())
  )

  function handleDeleteConversation(otherUserId: string) {
    deleteConversation.mutate(otherUserId)
    if (selectedUserId === otherUserId) setSelectedUserId(null)
    setConfirmDeleteId(null)
  }

  // Marque la conversation comme lue dès qu'on l'ouvre
  useEffect(() => {
    if (selectedUserId) markRead.mutate(selectedUserId)
  }, [selectedUserId])

  // Charge les contacts depuis les RDV existants
  useEffect(() => {
    if (!user) return
    async function loadContacts() {
      const { data } = await supabase
        .from('appointments')
        .select(user!.role === 'patient'
          ? 'doctor_id, doctors!inner(profiles!inner(first_name, last_name, user_id))'
          : 'patient_id, profiles!patient_id(first_name, last_name, user_id)'
        )
        .eq(user!.role === 'patient' ? 'patient_id' : 'doctor_id',
            user!.role === 'patient' ? user!.id : (await supabase.from('doctors').select('id').eq('user_id', user!.id).single()).data?.id
        )
      const seen = new Set<string>()
      const list: any[] = []
      ;(data ?? []).forEach((a: any) => {
        const p = user!.role === 'patient' ? a.doctors?.profiles : a.profiles
        if (p && !seen.has(p.user_id)) {
          seen.add(p.user_id)
          list.push({ user_id: p.user_id, name: `${p.first_name} ${p.last_name}` })
        }
      })
      setContacts(list)
    }
    loadContacts()
  }, [user])

  // Sélectionne la première conversation par défaut (priorité à celle avec
  // l'activité la plus récente, une fois les données chargées).
  useEffect(() => {
    if (!selectedUserId && sortedContacts.length > 0) setSelectedUserId(sortedContacts[0].user_id)
  }, [sortedContacts.length])

  // Realtime messages : écoute même sans conversation ouverte pour mettre
  // à jour la liste (tri + badge non-lus) dès qu'un message arrive.
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['messages'] })
        qc.invalidateQueries({ queryKey: ['conversation-partners'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, selectedUserId])

  // Scroll au dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selectedUserId) return
    await send.mutateAsync({ receiverId: selectedUserId, content: text.trim() })
    setText('')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 flex gap-4" style={{ height: 'calc(100vh - 4rem)' }}>

        {/* Liste contacts */}
        <aside className="w-64 flex-shrink-0 card overflow-y-auto">
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-2">Conversations</p>
            {sortedContacts.length > 0 && (
              <input
                type="text"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Rechercher..."
                className="input text-xs py-1.5"
              />
            )}
          </div>
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
        <div className="flex-1 card flex flex-col overflow-hidden">
          {!selectedUserId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
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
    </div>
  )
}
