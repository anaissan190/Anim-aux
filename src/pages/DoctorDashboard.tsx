// src/pages/DoctorDashboard.tsx
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfWeek, addDays, isSameDay, isThisWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import AppointmentCard from '@/components/appointment/AppointmentCard'
import { useCurrentDoctor, useDoctorAppointments, useAvailabilities, useDoctorReviews, useMyClinic, useClinicMembers, useClinicAppointments, useCreateClinic, useJoinClinic, useClinicServices, useAddClinicService, useDeleteClinicService, useUpdateClinic, useConversation, useSendMessage, useDoctorPatientAnimals } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { PRACTITIONER_TYPES, getPractitionerType } from '@/lib/practitionerTypes'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'

type Tab = 'home' | 'patients' | 'tarifs' | 'disponibilites' | 'profil' | 'avis' | 'messages'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',           label: 'Accueil',         icon: '🏠' },
  { id: 'patients',       label: 'Mes patients',    icon: '🐾' },
  { id: 'tarifs',         label: 'Tarifs',           icon: '💰' },
  { id: 'disponibilites', label: 'Disponibilités',   icon: '🗓️' },
  { id: 'profil',         label: 'Mon profil',       icon: '👤' },
  { id: 'avis',           label: 'Avis',             icon: '⭐' },
  { id: 'messages',       label: 'Messages',         icon: '💬' },
]


const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function DoctorDashboard() {
  const { profile } = useAuthStore()
  const { data: doctor } = useCurrentDoctor()
  const { data: appointments = [], isLoading } = useDoctorAppointments(doctor?.id)
  const { data: availabilities = [] } = useAvailabilities(doctor?.id ?? '')
  const { data: reviews = [] } = useDoctorReviews(doctor?.id ?? '')

  const { data: patientAnimals = [] } = useDoctorPatientAnimals(doctor?.id)
  const { data: clinic }              = useMyClinic(doctor?.id)
  const { data: clinicMembers = [] }  = useClinicMembers(clinic?.id)
  const { data: clinicAppts = [] }    = useClinicAppointments(clinic?.id)
  const { data: clinicServices = [] } = useClinicServices(clinic?.id)
  const createClinic      = useCreateClinic()
  const joinClinic        = useJoinClinic()
  const addClinicService  = useAddClinicService()
  const deleteClinicService = useDeleteClinicService()
  const updateClinic      = useUpdateClinic()
  const { user } = useAuthStore()
  const isClinicAdmin = clinic?.owner_id === user?.id

  const [tab, setTab] = useState<Tab>('home')
  const [apptTab, setApptTab] = useState<'today' | 'week' | 'all'>('today')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [dispoTab, setDispoTab] = useState<'personal' | 'shared'>('personal')
  const [clinicForm, setClinicForm] = useState({ name: '', city: '' })
  const [inviteCode, setInviteCode] = useState('')
  const [clinicMode, setClinicMode] = useState<'none' | 'create' | 'join'>('none')
  const [clinicError, setClinicError] = useState('')

  // Messages
  const qc = useQueryClient()
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [msgText, setMsgText] = useState('')
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const { data: messages = [] } = useConversation(selectedUserId ?? '')
  const send = useSendMessage()

  useEffect(() => {
    if (!user || tab !== 'messages') return
    async function loadContacts() {
      const doctorRow = await supabase.from('doctors').select('id').eq('user_id', user!.id).single()
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, users!patient_id(id, profiles(first_name, last_name, user_id))')
        .eq('doctor_id', doctorRow.data?.id)
      const seen = new Set<string>()
      const list: any[] = []
      ;(data ?? []).forEach((a: any) => {
        const p = a.users?.profiles
        if (p && !seen.has(p.user_id)) {
          seen.add(p.user_id)
          list.push({ user_id: p.user_id, name: `${p.first_name} ${p.last_name}` })
        }
      })
      setContacts(list)
      if (list.length > 0 && !selectedUserId) setSelectedUserId(list[0].user_id)
    }
    loadContacts()
  }, [user, tab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function searchUsers(query: string) {
    if (!query.trim()) { setSearchResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .neq('user_id', user?.id)
      .limit(8)
    setSearchResults(data ?? [])
  }

  useEffect(() => {
    if (!user || !selectedUserId) return
    const channel = supabase.channel('doctor-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['messages'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, selectedUserId])
  const practitionerType = getPractitionerType(doctor?.specialty
    ? PRACTITIONER_TYPES.find(p => p.label === doctor.specialty)?.id ?? ''
    : '')
  const defaultServices = (practitionerType?.services ?? []).map((s, i) => ({
    id: String(i + 1), name: s.name, price: null as number | null, duration: s.duration
  }))
  const [services, setServices] = useState(defaultServices)
  const [newService, setNewService] = useState({ name: '', price: '', duration: '' })
  const [addingService, setAddingService] = useState(false)

  const today     = new Date()
  const todayAppts = appointments.filter(a => isSameDay(new Date(a.start_at), today))
  const weekAppts  = appointments.filter(a => isThisWeek(new Date(a.start_at), { weekStartsOn: 1 }))
  const pending    = appointments.filter(a => a.status === 'pending').length
  const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const nextAppt   = todayAppts.find(a => new Date(a.start_at) >= today)

  const displayAppts =
    apptTab === 'today' ? todayAppts :
    apptTab === 'week'  ? weekAppts  :
    appointments

  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Barre d'onglets */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${tab === t.id
                    ? 'border-sage-500 text-sage-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── ACCUEIL ── */}
        {tab === 'home' && (
          <>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Bonjour, {profile?.first_name ?? ''} {profile?.last_name ?? ''} 👋
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  {doctor?.specialty}{doctor?.city ? ` · ${doctor.city}` : ''}
                </p>
              </div>
            </div>

            {nextAppt && (
              <div className="bg-sage-500 text-white rounded-2xl p-5 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium opacity-80 mb-1">Prochain rendez-vous</p>
                  <p className="text-lg font-bold">{format(new Date(nextAppt.start_at), 'HH:mm', { locale: fr })}</p>
                  <p className="text-sm opacity-90 mt-0.5">{nextAppt.reason ?? 'Consultation'}</p>
                </div>
                <div className="text-4xl">🗓️</div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Aujourd'hui", value: todayAppts.length, icon: '📅', color: 'text-sage-600' },
                { label: 'En attente',  value: pending,           icon: '⏳', color: pending > 0 ? 'text-amber-600' : 'text-gray-700' },
                { label: 'Cette semaine', value: weekAppts.length, icon: '📆', color: 'text-blue-600' },
                { label: 'Total',       value: appointments.length, icon: '📊', color: 'text-gray-700' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-xl mb-1">{m.icon}</p>
                  <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-5">
                {/* Mini calendrier */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">
                      Semaine du {format(weekStart, 'd MMM', { locale: fr })}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setWeekStart(d => addDays(d, -7))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">‹</button>
                      <button onClick={() => setWeekStart(d => addDays(d, 7))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">›</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map(day => {
                      const dayAppts = appointments.filter(a => isSameDay(new Date(a.start_at), day))
                      const isToday  = isSameDay(day, today)
                      return (
                        <div key={day.toISOString()}
                          className={`p-2 rounded-xl text-center text-xs
                            ${isToday ? 'bg-sage-500 text-white' : 'bg-gray-50 text-gray-600'}`}>
                          <p className="font-medium mb-1">{format(day, 'EEE', { locale: fr })}</p>
                          <p>{format(day, 'd')}</p>
                          {dayAppts.length > 0 && (
                            <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1.5
                              ${isToday ? 'bg-white' : 'bg-sage-400'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Liste RDV */}
                <div>
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 w-fit">
                    {(['today', 'week', 'all'] as const).map(t => (
                      <button key={t} onClick={() => setApptTab(t)}
                        className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors
                          ${apptTab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t === 'today' ? "Aujourd'hui" : t === 'week' ? 'Semaine' : 'Tous'}
                      </button>
                    ))}
                  </div>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />)}
                    </div>
                  ) : displayAppts.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                      <p className="text-3xl mb-3">📭</p>
                      <p className="text-gray-500 text-sm">Aucun rendez-vous pour cette période.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayAppts.map(a => <AppointmentCard key={a.id} appointment={a as any} showPatient />)}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-sm text-gray-900 mb-4">Mon profil</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2"><span>🩺</span><span>{doctor?.specialty || '—'}</span></div>
                    <div className="flex items-center gap-2"><span>📍</span><span>{doctor?.city || 'Ville non renseignée'}</span></div>
                    {avgRating && <div className="flex items-center gap-2"><span>⭐</span><span>{avgRating} / 5 ({reviews.length} avis)</span></div>}
                  </div>
                  <button onClick={() => setTab('profil')} className="w-full mt-4 text-sm py-2 px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    Modifier mon profil
                  </button>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-sm text-gray-900 mb-4">Actions rapides</h3>
                  <div className="space-y-2">
                    <button onClick={() => setTab('messages')} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>💬</span> Messages
                    </button>
                    <button onClick={() => setTab('disponibilites')} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>🗓️</span> Mes disponibilités
                    </button>
                    <button onClick={() => setTab('tarifs')} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>💰</span> Mes tarifs
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── MES PATIENTS ── */}
        {tab === 'patients' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Mes patients</h2>
              <p className="text-sm text-gray-500 mt-1">
                Animaux des patients ayant un rendez-vous confirmé ou terminé avec vous.
              </p>
            </div>
            {patientAnimals.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <p className="text-3xl mb-3">🐾</p>
                <p className="text-gray-500 text-sm">Aucun animal suivi pour l'instant.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {patientAnimals.map((a: any) => (
                  <Link key={a.id} to={`/animal/${a.id}`}
                    className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl mx-auto mb-2 overflow-hidden bg-gray-100 flex items-center justify-center">
                      {a.avatar_url
                        ? <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                        : <span className="text-3xl">{SPECIES_EMOJI[a.species] ?? '🐾'}</span>
                      }
                    </div>
                    <p className="font-semibold text-sm text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.breed ?? a.species}</p>
                    <p className="text-xs text-sage-600 mt-1">{a.ownerName}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TARIFS ── */}
        {tab === 'tarifs' && (
          <div className="max-w-2xl">
            {/* En cabinet */}
            {clinic ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Tarifs du cabinet</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Partagés avec tous les membres de <strong>{clinic.name}</strong>
                      {!isClinicAdmin && <span className="ml-1 text-amber-500">(modification réservée à l'admin)</span>}
                    </p>
                  </div>
                  {isClinicAdmin && (
                    <button onClick={() => setAddingService(true)} className="btn-primary text-sm px-4 py-2">
                      + Ajouter
                    </button>
                  )}
                </div>

                {isClinicAdmin && addingService && (
                  <div className="bg-sage-50 border border-sage-200 rounded-2xl p-5 mb-4">
                    <h3 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle prestation</h3>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <input className="input col-span-3" placeholder="Nom (ex: Vaccination)" value={newService.name}
                        onChange={e => setNewService(s => ({ ...s, name: e.target.value }))} />
                      <input className="input" placeholder="Prix (€)" type="number" value={newService.price}
                        onChange={e => setNewService(s => ({ ...s, price: e.target.value }))} />
                      <input className="input col-span-2" placeholder="Durée (ex: 30 min)" value={newService.duration}
                        onChange={e => setNewService(s => ({ ...s, duration: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        if (!newService.name) return
                        await addClinicService.mutateAsync({
                          clinicId: clinic.id,
                          name: newService.name,
                          price: newService.price ? Number(newService.price) : null,
                          duration: newService.duration,
                        })
                        setNewService({ name: '', price: '', duration: '' })
                        setAddingService(false)
                      }} className="btn-primary text-sm px-4 py-2">Ajouter</button>
                      <button onClick={() => setAddingService(false)} className="btn-secondary text-sm px-4 py-2">Annuler</button>
                    </div>
                  </div>
                )}

                {clinicServices.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-3xl mb-3">💰</p>
                    <p className="text-gray-500 text-sm">Aucune prestation renseignée pour ce cabinet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clinicServices.map((service: any) => (
                      <div key={service.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{service.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{service.duration}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-sage-600">
                            {service.price !== null ? `${service.price} €` : 'Sur devis'}
                          </span>
                          {isClinicAdmin && (
                            <button onClick={() => deleteClinicService.mutate({ id: service.id, clinicId: clinic.id })}
                              className="text-gray-300 hover:text-red-400 transition-colors text-lg">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Pas en cabinet — tarifs personnels */
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Mes tarifs</h2>
                    <p className="text-sm text-gray-500 mt-1">Gérez vos prestations et leurs prix</p>
                  </div>
                  <button onClick={() => setAddingService(true)} className="btn-primary text-sm px-4 py-2">
                    + Ajouter une prestation
                  </button>
                </div>

                {addingService && (
                  <div className="bg-sage-50 border border-sage-200 rounded-2xl p-5 mb-4">
                    <h3 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle prestation</h3>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <input className="input col-span-3" placeholder="Nom (ex: Vaccination)" value={newService.name}
                        onChange={e => setNewService(s => ({ ...s, name: e.target.value }))} />
                      <input className="input" placeholder="Prix (€)" type="number" value={newService.price}
                        onChange={e => setNewService(s => ({ ...s, price: e.target.value }))} />
                      <input className="input col-span-2" placeholder="Durée (ex: 30 min)" value={newService.duration}
                        onChange={e => setNewService(s => ({ ...s, duration: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        if (newService.name) {
                          setServices(s => [...s, { id: Date.now().toString(), name: newService.name, price: newService.price ? Number(newService.price) : null, duration: newService.duration }])
                          setNewService({ name: '', price: '', duration: '' })
                          setAddingService(false)
                        }
                      }} className="btn-primary text-sm px-4 py-2">Ajouter</button>
                      <button onClick={() => setAddingService(false)} className="btn-secondary text-sm px-4 py-2">Annuler</button>
                    </div>
                  </div>
                )}

                {services.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-3xl mb-3">💰</p>
                    <p className="text-gray-500 text-sm">Aucune prestation renseignée.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {services.map(service => (
                      <div key={service.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{service.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{service.duration}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-sage-600">
                            {service.price !== null ? `${service.price} €` : 'Sur devis'}
                          </span>
                          <button onClick={() => setServices(s => s.filter(sv => sv.id !== service.id))}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── DISPONIBILITÉS ── */}
        {tab === 'disponibilites' && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Disponibilités</h2>
            </div>

            {/* Sous-onglets */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
              {([
                { id: 'personal', label: '📅 Mes disponibilités' },
                { id: 'shared',   label: '🏥 Agenda partagé' },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setDispoTab(t.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${dispoTab === t.id ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Mes disponibilités personnelles */}
            {dispoTab === 'personal' && (
              availabilities.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                  <p className="text-3xl mb-3">🗓️</p>
                  <p className="text-gray-500 text-sm mb-4">Vous n'avez pas encore renseigné vos disponibilités.</p>
                  <button className="btn-primary text-sm px-4 py-2">Ajouter des créneaux</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {DAYS.map((day, i) => {
                    const slots = availabilities.filter((a: any) => a.day_of_week === (i + 1) % 7)
                    return (
                      <div key={day} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                        <span className="font-medium text-gray-700 w-24">{day}</span>
                        <div className="flex-1">
                          {slots.length === 0 ? (
                            <span className="text-sm text-gray-400">Indisponible</span>
                          ) : slots.map((s: any) => (
                            <span key={s.id} className="inline-block bg-sage-50 text-sage-700 text-xs px-3 py-1 rounded-full mr-2">
                              {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                            </span>
                          ))}
                        </div>
                        <button className="text-sm text-sage-600 hover:underline">Modifier</button>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Agenda partagé */}
            {dispoTab === 'shared' && (
              <>
                {/* Pas encore dans un cabinet */}
                {!clinic && clinicMode === 'none' && (
                  <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-3xl mb-3">🏥</p>
                    <p className="text-gray-700 font-medium mb-1">Vous n'êtes dans aucun cabinet</p>
                    <p className="text-gray-400 text-sm mb-6">Créez un cabinet ou rejoignez-en un avec un code d'invitation.</p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={() => setClinicMode('create')} className="btn-primary text-sm px-5 py-2">
                        Créer un cabinet
                      </button>
                      <button onClick={() => setClinicMode('join')} className="btn-secondary text-sm px-5 py-2">
                        Rejoindre un cabinet
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulaire créer */}
                {!clinic && clinicMode === 'create' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm max-w-md">
                    <h3 className="font-semibold text-gray-900 mb-4">Créer un cabinet</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du cabinet</label>
                        <input className="input" placeholder="Cabinet vétérinaire du Parc"
                          value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                        <input className="input" placeholder="Paris"
                          value={clinicForm.city} onChange={e => setClinicForm(f => ({ ...f, city: e.target.value }))} />
                      </div>
                      {clinicError && <p className="text-red-500 text-sm">{clinicError}</p>}
                      <div className="flex gap-2 pt-2">
                        <button onClick={async () => {
                          if (!clinicForm.name || !doctor?.id) return
                          setClinicError('')
                          try {
                            await createClinic.mutateAsync({ name: clinicForm.name, city: clinicForm.city, doctorId: doctor.id })
                            setClinicMode('none')
                          } catch (e: any) { setClinicError(e.message ?? 'Erreur lors de la création') }
                        }} className="btn-primary text-sm px-4 py-2" disabled={createClinic.isPending}>
                          {createClinic.isPending ? 'Création...' : 'Créer'}
                        </button>
                        <button onClick={() => setClinicMode('none')} className="btn-secondary text-sm px-4 py-2">Annuler</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Formulaire rejoindre */}
                {!clinic && clinicMode === 'join' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm max-w-md">
                    <h3 className="font-semibold text-gray-900 mb-4">Rejoindre un cabinet</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Code d'invitation</label>
                        <input className="input uppercase tracking-widest" placeholder="EX: AB12CD34"
                          value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
                      </div>
                      {clinicError && <p className="text-red-500 text-sm">{clinicError}</p>}
                      <div className="flex gap-2 pt-2">
                        <button onClick={async () => {
                          if (!inviteCode || !doctor?.id) return
                          try {
                            await joinClinic.mutateAsync({ inviteCode, doctorId: doctor.id })
                            setClinicMode('none')
                          } catch (e: any) { setClinicError(e.message) }
                        }} className="btn-primary text-sm px-4 py-2" disabled={joinClinic.isPending}>
                          {joinClinic.isPending ? 'Recherche...' : 'Rejoindre'}
                        </button>
                        <button onClick={() => setClinicMode('none')} className="btn-secondary text-sm px-4 py-2">Annuler</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cabinet existant */}
                {clinic && (
                  <div className="space-y-5">
                    {/* Infos cabinet */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{clinic.name}</h3>
                          {clinic.city && <p className="text-sm text-gray-500 mt-0.5">📍 {clinic.city}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 mb-1">Code d'invitation</p>
                          <span className="font-mono font-bold text-sage-600 bg-sage-50 px-3 py-1 rounded-lg text-sm tracking-widest">
                            {clinic.invite_code}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Membres */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <h3 className="font-semibold text-gray-900 mb-4">
                        Membres du cabinet ({clinicMembers.length})
                      </h3>
                      <div className="space-y-3">
                        {clinicMembers.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-bold text-sm">
                              {m.doctors?.profiles?.first_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {m.doctors?.profiles?.first_name} {m.doctors?.profiles?.last_name}
                              </p>
                              <p className="text-xs text-gray-400">{m.doctors?.specialty}</p>
                            </div>
                            {clinic.owner_id === m.doctors?.user_id && (
                              <span className="ml-auto text-xs bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full">Admin</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Agenda partagé */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <h3 className="font-semibold text-gray-900 mb-4">Agenda du cabinet</h3>
                      {clinicAppts.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-gray-400 text-sm">Aucun rendez-vous à venir dans le cabinet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {clinicAppts.slice(0, 10).map((a: any) => (
                            <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                              <div className="text-center min-w-[48px]">
                                <p className="text-xs text-gray-400">{format(new Date(a.start_at), 'EEE', { locale: fr })}</p>
                                <p className="text-sm font-bold text-gray-700">{format(new Date(a.start_at), 'd MMM', { locale: fr })}</p>
                                <p className="text-xs text-sage-600">{format(new Date(a.start_at), 'HH:mm')}</p>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-600">{a.reason ?? 'Consultation'}</p>
                                <p className="text-xs text-gray-400">
                                  Dr {a.doctors?.profiles?.first_name} {a.doctors?.profiles?.last_name}
                                </p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${a.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                  a.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-500'}`}>
                                {a.status === 'confirmed' ? 'Confirmé' : a.status === 'pending' ? 'En attente' : a.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MON PROFIL ── */}
        {tab === 'profil' && (
          <div className="max-w-2xl space-y-6">

            {/* Profil du cabinet (si membre) */}
            {clinic && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Profil du cabinet</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Visible par les patients sur la fiche du cabinet</p>
                  </div>
                  {!isClinicAdmin && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Modification réservée à l'admin</span>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du cabinet</label>
                    <input className="input" defaultValue={clinic.name}
                      disabled={!isClinicAdmin}
                      id="clinic-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                      <input className="input" defaultValue={clinic.city ?? ''}
                        disabled={!isClinicAdmin} id="clinic-city" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                      <input className="input" defaultValue={clinic.address ?? ''}
                        disabled={!isClinicAdmin} id="clinic-address" />
                    </div>
                  </div>
                  {isClinicAdmin && (
                    <button onClick={async () => {
                      const name    = (document.getElementById('clinic-name') as HTMLInputElement).value
                      const city    = (document.getElementById('clinic-city') as HTMLInputElement).value
                      const address = (document.getElementById('clinic-address') as HTMLInputElement).value
                      await updateClinic.mutateAsync({ id: clinic.id, name, city, address })
                    }} className="btn-primary w-full">
                      {updateClinic.isPending ? 'Enregistrement...' : 'Enregistrer les modifications du cabinet'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Profil personnel */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {clinic ? 'Mon profil personnel' : 'Mon profil'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {clinic
                    ? 'Visible dans l\'agenda partagé du cabinet'
                    : 'Ces informations sont visibles par les patients'}
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <input className="input" defaultValue={profile?.first_name ?? ''} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input className="input" defaultValue={profile?.last_name ?? ''} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité / Métier</label>
                  <input className="input" defaultValue={doctor?.specialty ?? ''} />
                </div>
                {!clinic && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                        <input className="input" defaultValue={doctor?.city ?? ''} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                        <input className="input" defaultValue={doctor?.address ?? ''} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Présentation</label>
                      <textarea className="input h-28 resize-none" defaultValue={doctor?.bio ?? ''}
                        placeholder="Décrivez votre activité, votre expérience..." />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input className="input" defaultValue={profile?.phone ?? ''} />
                </div>
                <button className="btn-primary w-full">Enregistrer mes informations</button>
              </div>
            </div>
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === 'messages' && (
          <div className="flex gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
            {/* Contacts */}
            <aside className="w-64 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Conversations</p>
                <button onClick={() => { setShowNewMsg(true); setSearchQuery(''); setSearchResults([]) }}
                  className="text-xs bg-sage-500 text-white px-3 py-1.5 rounded-lg hover:bg-sage-600 transition-colors">
                  + Nouveau
                </button>
              </div>

              {/* Recherche nouveau message */}
              {showNewMsg && (
                <div className="p-3 border-b border-gray-100 bg-sage-50">
                  <p className="text-xs font-medium text-gray-600 mb-2">Nouveau message</p>
                  <input
                    className="input text-sm w-full"
                    placeholder="Rechercher un utilisateur..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value) }}
                    autoFocus
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchResults.map(r => (
                        <button key={r.user_id}
                          onClick={() => {
                            const name = `${r.first_name} ${r.last_name}`
                            if (!contacts.find(c => c.user_id === r.user_id)) {
                              setContacts(prev => [{ user_id: r.user_id, name }, ...prev])
                            }
                            setSelectedUserId(r.user_id)
                            setShowNewMsg(false)
                            setSearchQuery('')
                            setSearchResults([])
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors text-sm">
                          <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center text-xs text-sage-700 font-bold flex-shrink-0">
                            {r.first_name[0]}
                          </div>
                          <span className="text-gray-700">{r.first_name} {r.last_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery && searchResults.length === 0 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">Aucun résultat</p>
                  )}
                  <button onClick={() => setShowNewMsg(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-2 w-full text-center">
                    Annuler
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {contacts.length === 0 ? (
                  <p className="text-xs text-gray-400 p-4 text-center">Aucune conversation pour l'instant.</p>
                ) : contacts.map(c => (
                  <button key={c.user_id} onClick={() => setSelectedUserId(c.user_id)}
                    className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors
                      ${selectedUserId === c.user_id ? 'bg-sage-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-xs text-sage-700 font-bold flex-shrink-0">
                      {c.name[0]}
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{c.name}</p>
                  </button>
                ))}
              </div>
            </aside>

            {/* Zone chat */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              {!selectedUserId ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Sélectionnez une conversation
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-gray-100 flex-shrink-0">
                    <p className="font-semibold text-sm text-gray-900">
                      {contacts.find(c => c.user_id === selectedUserId)?.name}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((m: any) => {
                      const mine = m.sender_id === user?.id
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm
                            ${mine ? 'bg-sage-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
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
                  <form onSubmit={async e => {
                    e.preventDefault()
                    if (!msgText.trim() || !selectedUserId) return
                    await send.mutateAsync({ receiverId: selectedUserId, content: msgText.trim() })
                    setMsgText('')
                  }} className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
                    <input value={msgText} onChange={e => setMsgText(e.target.value)}
                      placeholder="Votre message..." className="input flex-1" />
                    <button type="submit" disabled={!msgText.trim() || send.isPending}
                      className="btn-primary px-5">Envoyer</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── AVIS ── */}
        {tab === 'avis' && (
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Avis patients</h2>
                <p className="text-sm text-gray-500 mt-1">{reviews.length} avis au total</p>
              </div>
              {avgRating && (
                <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100 text-center">
                  <p className="text-3xl font-bold text-sage-600">{avgRating}</p>
                  <p className="text-xs text-gray-400">/ 5</p>
                </div>
              )}
            </div>
            {reviews.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <p className="text-3xl mb-3">⭐</p>
                <p className="text-gray-500 text-sm">Aucun avis pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{format(new Date(r.created_at), 'd MMM yyyy', { locale: fr })}</span>
                    </div>
                    {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
