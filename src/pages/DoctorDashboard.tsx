// src/pages/DoctorDashboard.tsx
import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import AnimalBackground from '@/components/ui/AnimalBackground'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import AppointmentCard from '@/components/appointment/AppointmentCard'
import { useCurrentDoctor, useDoctorAppointments, useAvailabilities, useDoctorReviews, useMyClinic, useClinicMembers, useClinicAppointments, useCreateClinic, useJoinClinic, useClinicServices, useAddClinicService, useDeleteClinicService, useDoctorServices, useAddDoctorService, useDeleteDoctorService, useUpdateClinic, useConversation, useSendMessage, useConversationPartners, useMarkConversationRead, useDoctorPatientAnimals, useCreateAvailability, useDeleteAvailability, useBlockedSlots, useCreateBlockedSlot, useDeleteBlockedSlot, useUpdateProfile, useUpdateDoctor, useDeleteAccount, useRemoveClinicMember, useClinicAvailabilities, useClinicBlockedSlotsAll, useAppointmentDocuments, useInviteClinicSecretary, useClinicStaffList, useExportMyData,
  useDoctorVerificationDocuments, useUploadVerificationDocument, useDeleteVerificationDocument } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { PRACTITIONER_TYPES } from '@/lib/practitionerTypes'
import { SPECIES_EMOJI, PRACTICE_SPECIES_OPTIONS } from '@/lib/animalSpecies'
import { type DoctorTab as Tab, ALL_DOCTOR_TAB_IDS as ALL_TAB_IDS } from '@/lib/doctorDashboardTabs'
import { computeDoctorStats } from '@/lib/doctorStats'

// La barre d'onglets (Accueil, Mes patients, Tarifs, Disponibilités, Avis)
// est désormais affichée dans la Navbar, à la suite du logo, pour être
// visible dès l'arrivée sur la page d'accueil sans clic supplémentaire —
// voir src/components/ui/Navbar.tsx. Ce fichier ne gère plus que le
// contenu de chaque onglet, piloté par le paramètre d'URL ?tab=.


const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function DoctorDashboard() {
  const { profile } = useAuthStore()
  const { data: doctor } = useCurrentDoctor()
  const { data: appointments = [], isLoading } = useDoctorAppointments(doctor?.id)
  const { data: availabilities = [] } = useAvailabilities(doctor?.id ?? '')
  const { data: reviews = [] } = useDoctorReviews(doctor?.id ?? '')

  const { data: clinic, isLoading: clinicLoading } = useMyClinic(doctor?.id)
  const { data: patientAnimals = [], isLoading: patientAnimalsLoading } = useDoctorPatientAnimals(doctor?.id, clinic?.id, !clinicLoading)
  const [patientSearch, setPatientSearch] = useState('')
  const filteredPatientAnimals = patientAnimals.filter((a: any) => {
    const q = patientSearch.trim().toLowerCase()
    if (!q) return true
    return a.name?.toLowerCase().includes(q) || a.ownerName?.toLowerCase().includes(q)
  })
  const createAvailability = useCreateAvailability()
  const deleteAvailability = useDeleteAvailability()
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [slotForm, setSlotForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '18:00' })
  const [slotError, setSlotError] = useState('')

  const { data: blockedSlots = [] } = useBlockedSlots(doctor?.id)
  const createBlockedSlot = useCreateBlockedSlot()
  const deleteBlockedSlot = useDeleteBlockedSlot()
  const [showAddBlocked, setShowAddBlocked] = useState(false)
  const [blockedForm, setBlockedForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [blockedError, setBlockedError] = useState('')

  const updateProfile = useUpdateProfile()
  const updateDoctorInfo = useUpdateDoctor()
  const [profileForm, setProfileForm] = useState({
    first_name: '', last_name: '', specialty: '', city: '', address: '', bio: '', phone: '',
    accepted_species: [] as string[], home_visit: false,
  })
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [clinicLogoUploading, setClinicLogoUploading] = useState(false)
  const [clinicLogoError, setClinicLogoError] = useState('')
  const { data: clinicMembers = [] }  = useClinicMembers(clinic?.id)
  const { data: clinicStaff = [] }    = useClinicStaffList(clinic?.id)
  const { data: clinicAppts = [], error: clinicApptsError } = useClinicAppointments(clinic?.id)
  const { data: clinicServices = [] } = useClinicServices(clinic?.id)
  const { data: doctorServices = [] } = useDoctorServices(doctor?.id)
  const { data: clinicAvailabilities = [] } = useClinicAvailabilities(clinic?.id)
  const { data: clinicBlockedAll = [] }     = useClinicBlockedSlotsAll(clinic?.id)
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0)
  const calendarWeekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), calendarWeekOffset * 7 + i)
  )
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date>(new Date())
  const [selectedApptDetail, setSelectedApptDetail] = useState<any | null>(null)
  const { data: selectedApptDocuments = [] } = useAppointmentDocuments(selectedApptDetail?.id)
  const createClinic      = useCreateClinic()
  const joinClinic        = useJoinClinic()
  const addClinicService  = useAddClinicService()
  const deleteClinicService = useDeleteClinicService()
  const addDoctorService  = useAddDoctorService()
  const deleteDoctorService = useDeleteDoctorService()
  const updateClinic      = useUpdateClinic()
  const removeClinicMember = useRemoveClinicMember()
  const [removeMemberError, setRemoveMemberError] = useState('')
  const inviteSecretary = useInviteClinicSecretary()
  const [secretaryEmail, setSecretaryEmail] = useState('')
  const [secretaryInviteError, setSecretaryInviteError] = useState('')
  const [secretaryInviteSuccess, setSecretaryInviteSuccess] = useState(false)
  const [secretaryLoginIdentifier, setSecretaryLoginIdentifier] = useState('')
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const isClinicAdmin = clinic?.owner_id === user?.id
  const deleteAccount = useDeleteAccount()
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const exportMyData = useExportMyData()
  const [exportError, setExportError] = useState('')

  const { data: verificationDocuments = [] } = useDoctorVerificationDocuments(doctor?.id)
  const uploadVerificationDocument = useUploadVerificationDocument()
  const deleteVerificationDocument = useDeleteVerificationDocument()
  const [verificationDocType, setVerificationDocType] = useState('Diplôme')
  const [verificationUploading, setVerificationUploading] = useState(false)
  const [verificationError, setVerificationError] = useState('')

  async function handleUploadVerificationDocument(file: File) {
    if (!doctor) return
    setVerificationUploading(true)
    setVerificationError('')
    try {
      await uploadVerificationDocument.mutateAsync({ doctorId: doctor.id, file, documentType: verificationDocType })
    } catch (e: any) {
      setVerificationError(e.message ?? "Erreur lors de l'envoi du document.")
    } finally {
      setVerificationUploading(false)
    }
  }

  async function handleExportData() {
    setExportError('')
    try {
      const data = await exportMyData.mutateAsync()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `animeaux-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setExportError(e.message ?? "Erreur lors de l'export des données.")
    }
  }

  async function handleDeleteAccount() {
    setDeleteAccountError('')
    try {
      await deleteAccount.mutateAsync()
      await signOut()
      navigate('/')
    } catch (e: any) {
      setDeleteAccountError(e.message ?? 'Erreur lors de la suppression du compte.')
    }
  }

  // Préremplit le formulaire "Mon profil" une seule fois au chargement.
  // Sans le garde-fou `profileInitialized`, ce useEffect se redéclenchait à
  // chaque rafraîchissement en arrière-plan de `profile`/`doctor` (ex: retour
  // sur l'onglet du navigateur) et effaçait ce que le praticien était en
  // train de taper (la bio, notamment).
  const profileInitialized = useRef(false)
  useEffect(() => {
    if (profileInitialized.current) return
    if (!profile || !doctor) return
    setProfileForm({
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      specialty: doctor.specialty ?? '',
      city: doctor.city ?? '',
      address: doctor.address ?? '',
      bio: doctor.bio ?? '',
      phone: profile.phone ?? '',
      accepted_species: doctor.accepted_species ?? [],
      home_visit: doctor.home_visit ?? false,
    })
    profileInitialized.current = true
  }, [profile, doctor])

  function toggleProfileSpecies(id: string) {
    setProfileForm(f => ({
      ...f,
      accepted_species: f.accepted_species.includes(id)
        ? f.accepted_species.filter(s => s !== id)
        : [...f.accepted_species, id],
    }))
  }

  async function submitProfile() {
    setProfileError('')
    setProfileSaved(false)
    try {
      await Promise.all([
        updateProfile.mutateAsync({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone,
        }),
        updateDoctorInfo.mutateAsync({
          specialty: profileForm.specialty,
          city: profileForm.city,
          address: profileForm.address,
          bio: profileForm.bio,
          accepted_species: profileForm.accepted_species,
          home_visit: profileForm.home_visit,
        }),
      ])
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch (e: any) {
      setProfileError(e.message ?? "Erreur lors de l'enregistrement.")
    }
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `profiles/${user!.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile.mutateAsync({ avatar_url: data.publicUrl })
    } catch (e: any) {
      setPhotoError(e.message ?? "Erreur lors de l'envoi de la photo.")
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleClinicLogoUpload(file: File) {
    if (!clinic) return
    setClinicLogoUploading(true)
    setClinicLogoError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `clinics/${clinic.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateClinic.mutateAsync({
        id: clinic.id, name: clinic.name, address: clinic.address ?? undefined,
        city: clinic.city ?? undefined, phone: clinic.phone ?? undefined, logo_url: data.publicUrl,
      })
    } catch (e: any) {
      setClinicLogoError(e.message ?? "Erreur lors de l'envoi du logo.")
    } finally {
      setClinicLogoUploading(false)
    }
  }

  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(
    ALL_TAB_IDS.includes(initialTab as Tab) ? (initialTab as Tab) : 'home'
  )
  // Les icônes Messages/Profil de la Navbar pointent vers cette même page
  // (/dashboard/doctor?tab=...) : comme on y est déjà, React Router ne
  // remonte pas le composant, donc seul le useState initial ne suffit pas —
  // il faut aussi réagir aux changements de ?tab= une fois la page ouverte.
  useEffect(() => {
    const t = searchParams.get('tab')
    if (ALL_TAB_IDS.includes(t as Tab)) setTab(t as Tab)
  }, [searchParams])
  const [apptTab, setApptTab] = useState<'today' | 'week' | 'all'>('today')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const { data: messages = [] } = useConversation(selectedUserId ?? '')
  const send = useSendMessage()
  const { data: partners = [] } = useConversationPartners()
  const markRead = useMarkConversationRead()
  const [messageSearch, setMessageSearch] = useState('')
  const [confirmDeleteConvId, setConfirmDeleteConvId] = useState<string | null>(null)
  // Conversations supprimées : une fois supprimée, un contact issu des RDV
  // (relation permanente) ne doit pas réapparaître tout seul dans le feed —
  // on le masque tant qu'aucun nouveau message n'est rééchangé avec lui.
  // On stocke la date du masquage (et non un simple booléen) pour pouvoir
  // le comparer à last_message_at et le réafficher automatiquement dès
  // qu'un message plus récent arrive, sans dépendre du canal realtime
  // (qui peut ne jamais se déclencher selon la config du projet Supabase).
  const [hiddenConvIds, setHiddenConvIds] = useState<Record<string, string>>(() => {
    if (!user) return {}
    try {
      const raw = JSON.parse(localStorage.getItem(`animeaux-hidden-conversations-${user.id}`) ?? '{}')
      return Array.isArray(raw) ? {} : raw // ancien format (tableau) : on l'ignore
    } catch { return {} }
  })
  function persistHiddenConvIds(map: Record<string, string>) {
    setHiddenConvIds(map)
    if (user) localStorage.setItem(`animeaux-hidden-conversations-${user.id}`, JSON.stringify(map))
  }

  // La liste vient en priorité de get_conversation_partners() (construite
  // directement à partir des messages échangés — fiable, avec les noms
  // résolus), complétée par les patients issus des RDV pour pouvoir démarrer
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
        const hiddenAt = hiddenConvIds[c.user_id]
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

  // Recherche par nom de contact OU nom d'un de ses animaux
  const filteredMessageContacts = sortedContacts.filter((c: any) => {
    const q = messageSearch.trim().toLowerCase()
    if (!q) return true
    if (c.name.toLowerCase().includes(q)) return true
    return patientAnimals.some((a: any) => a.owner_id === c.user_id && a.name?.toLowerCase().includes(q))
  })

  // Masquage personnel uniquement : on ne touche jamais aux messages en base
  // (ils sont partagés avec le patient). Supprimer une conversation de son
  // côté ne doit jamais faire disparaître l'historique chez l'autre personne.
  function handleDeleteConversation(otherUserId: string) {
    if (selectedUserId === otherUserId) setSelectedUserId(null)
    setConfirmDeleteConvId(null)
    persistHiddenConvIds({ ...hiddenConvIds, [otherUserId]: new Date().toISOString() })
  }

  // Renvoyer un message à un contact masqué (ou en recevoir un via le
  // realtime) le fait réapparaître immédiatement — sinon le filtre par date
  // s'en charge de toute façon dès le prochain rafraîchissement.
  function unhideConversation(otherUserId: string) {
    if (!(otherUserId in hiddenConvIds)) return
    const { [otherUserId]: _removed, ...rest } = hiddenConvIds
    persistHiddenConvIds(rest)
  }

  useEffect(() => {
    if (selectedUserId) markRead.mutate(selectedUserId)
  }, [selectedUserId])

  useEffect(() => {
    if (!user || tab !== 'messages') return
    async function loadContacts() {
      const doctorRow = await supabase.from('doctors').select('id').eq('user_id', user!.id).single()
      const { data: appts } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', doctorRow.data?.id)
      const patientIds = [...new Set((appts ?? []).map((a: any) => a.patient_id))]
      if (patientIds.length === 0) { setContacts([]); return }
      // Requête directe sur `profiles` (policy RLS dédiée) : un embed via
      // `users` renvoie null car aucune policy RLS ne permet à un praticien
      // de lire la ligne `users` d'un autre utilisateur (même bug que
      // l'onglet Mes patients).
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', patientIds)
      const list = (profilesData ?? []).map((p: any) => ({ user_id: p.user_id, name: `${p.first_name} ${p.last_name}` }))
      setContacts(list)
    }
    loadContacts()
  }, [user, tab])

  // Sélectionne la première conversation par défaut (activité la plus
  // récente) une fois les données chargées.
  useEffect(() => {
    if (!selectedUserId && sortedContacts.length > 0) setSelectedUserId(sortedContacts[0].user_id)
  }, [sortedContacts.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // "Nouveau message" : uniquement les patients avec qui le praticien a eu
  // un rendez-vous (liste `contacts`, dérivée des appointments), filtrés par
  // le texte recherché — jamais une recherche ouverte sur tous les profils.
  const newMsgResults = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('doctor-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ['messages'] })
        qc.invalidateQueries({ queryKey: ['conversation-partners'] })
        // Si le patient qui vient d'écrire avait été masqué (suite à une
        // suppression de conversation de notre côté), on le ré-affiche : un
        // nouveau message mérite de réapparaître dans le feed, même sans
        // réponse de notre part.
        const m = payload.new
        if (m && m.receiver_id === user.id) unhideConversation(m.sender_id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])
  const [newService, setNewService] = useState({ name: '', price: '', duration: '' })
  const [addingService, setAddingService] = useState(false)

  // Tarifs du cabinet regroupés par praticien — chaque membre inscrit les
  // siens, affichés sous son propre nom.
  const servicesByDoctor = (() => {
    const byId = new Map<string, { doctorId: string; name: string; specialty: string; services: any[] }>()
    for (const s of clinicServices as any[]) {
      const d = s.doctors
      const key = s.doctor_id ?? 'unknown'
      if (!byId.has(key)) {
        byId.set(key, {
          doctorId: key,
          name: d?.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : 'Praticien',
          specialty: d?.specialty ?? '',
          services: [],
        })
      }
      byId.get(key)!.services.push(s)
    }
    return [...byId.values()]
  })()

  const today     = new Date()
  const todayAppts = appointments.filter(a => isSameDay(new Date(a.start_at), today))
  const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  // Basé sur la semaine actuellement affichée dans le mini calendrier
  // (navigable via ‹ ›), pas sur la semaine réelle en cours : sinon l'onglet
  // "Semaine" et le mini calendrier pouvaient se désynchroniser.
  const weekEnd    = addDays(weekStart, 7)
  const weekAppts  = appointments.filter(a => {
    const d = new Date(a.start_at)
    return d >= weekStart && d < weekEnd
  })
  const pending    = appointments.filter(a => a.status === 'pending').length
  const nextAppt   = todayAppts.find(a => new Date(a.start_at) >= today)

  const displayAppts =
    selectedDay ? appointments.filter(a => isSameDay(new Date(a.start_at), selectedDay)) :
    apptTab === 'today' ? todayAppts :
    apptTab === 'week'  ? weekAppts  :
    appointments

  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  // Statistiques praticien (onglet "Statistiques") — logique pure extraite
  // dans src/lib/doctorStats.ts (testée indépendamment du composant).
  const {
    noShowRate, cancellationRate, totalRevenue, revenueLast30Days, fillRate, hasUnclosedPastAppts,
  } = computeDoctorStats(appointments, availabilities, doctor?.consultation_price ?? 0, today)

  return (
    <div className={`relative min-h-screen ${tab === 'home' ? 'bg-sage-50' : 'bg-[#FFFAF0]'}`}>
      {/* Le fond animaux n'est affiché que sur l'onglet Accueil — c'est le
          seul qui correspond à "Mon espace" ; les autres onglets (Mes
          patients, Tarifs, Disponibilités, Avis, Profil, Messages) gardent
          le fond beige uni d'avant. */}
      {tab === 'home' && <AnimalBackground />}
      <div className="relative z-10">
      {/* La barre d'onglets (Accueil, Mes patients, Tarifs, Disponibilités,
          Avis) est affichée dans la Navbar elle-même, à la suite du logo —
          voir src/components/ui/Navbar.tsx. */}
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Bannière de statut de vérification — visible sur tous les onglets
            tant que le dossier n'est pas validé, pour rappeler que le profil
            reste invisible en recherche jusque-là (voir useDoctors). */}
        {doctor && doctor.verification_status !== 'verified' && (
          <div className={`rounded-2xl p-4 mb-6 text-sm flex items-start gap-3 ${
            doctor.verification_status === 'rejected'
              ? 'bg-red-50 border border-red-100 text-red-700'
              : 'bg-amber-50 border border-amber-100 text-amber-700'
          }`}>
            <span className="text-lg">{doctor.verification_status === 'rejected' ? '⚠️' : '⏳'}</span>
            <div className="flex-1">
              {doctor.verification_status === 'rejected' ? (
                <>
                  <p className="font-medium">Documents non validés</p>
                  <p className="mt-0.5">
                    {doctor.verification_rejected_reason || "Vos documents n'ont pas pu être validés."} Merci de les redéposer.
                  </p>
                </>
              ) : (
                <p>
                  <span className="font-medium">Profil en attente de vérification.</span> Vous pouvez utiliser votre
                  espace normalement, mais vous n'apparaîtrez dans les résultats de recherche qu'une fois vos
                  documents justificatifs déposés et validés.
                </p>
              )}
              <Link to="/dashboard/doctor?tab=profil" className="underline font-medium mt-1 inline-block">
                Déposer mes documents
              </Link>
            </div>
          </div>
        )}

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
                { label: "Aujourd'hui", value: todayAppts.length, icon: '📅' },
                { label: 'En attente',  value: pending,           icon: '⏳' },
                { label: 'Cette semaine', value: weekAppts.length, icon: '📆' },
                { label: 'Total',       value: appointments.length, icon: '📊' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-xl mb-1">{m.icon}</p>
                  <p className={`text-3xl font-bold ${m.value === 0 ? 'text-sage-600' : 'text-moss-500'}`}>{m.value}</p>
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
                      const isToday    = isSameDay(day, today)
                      const isSelected = !!selectedDay && isSameDay(day, selectedDay)
                      return (
                        <button key={day.toISOString()} type="button"
                          onClick={() => setSelectedDay(d => d && isSameDay(d, day) ? null : day)}
                          className={`p-2 rounded-xl text-center text-xs transition-colors cursor-pointer
                            ${isToday ? 'bg-sage-500 text-white' : isSelected ? 'bg-sage-100 text-sage-700 ring-2 ring-sage-400' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                          <p className="font-medium mb-1">{format(day, 'EEE', { locale: fr })}</p>
                          <p>{format(day, 'd')}</p>
                          {dayAppts.length > 0 && (
                            <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1.5
                              ${isToday ? 'bg-white' : 'bg-sage-400'}`} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {selectedDay && (
                    <p className="text-xs text-sage-600 mt-2">
                      Rendez-vous du {format(selectedDay, "EEEE d MMMM", { locale: fr })}
                      <button onClick={() => setSelectedDay(null)} className="ml-2 text-gray-400 hover:underline">Réinitialiser</button>
                    </p>
                  )}
                </div>

                {/* Liste RDV */}
                <div>
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 w-fit">
                    {(['today', 'week', 'all'] as const).map(t => (
                      <button key={t} onClick={() => { setApptTab(t); setSelectedDay(null) }}
                        className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors
                          ${!selectedDay && apptTab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
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
                  <Link to="/dashboard/doctor?tab=profil" className="block w-full mt-4 text-sm py-2 px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-center">
                    Modifier mon profil
                  </Link>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-sm text-gray-900 mb-4">Actions rapides</h3>
                  <div className="space-y-2">
                    <Link to="/dashboard/doctor?tab=messages" className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>💬</span> Messages
                    </Link>
                    <Link to="/dashboard/doctor?tab=disponibilites" className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>🗓️</span> Mes disponibilités
                    </Link>
                    <Link to="/dashboard/doctor?tab=tarifs" className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>💰</span> Mes tarifs
                    </Link>
                    {/* Espace secrétariat : compte à part entière avec ses
                        propres identifiants — ce lien renvoie vers la page
                        de connexion, pas vers un dashboard partagé avec
                        cette session (voir invite-clinic-secretary). */}
                    <Link to="/login" className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <span>🏥</span> Espace secrétariat
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── MES PATIENTS ── */}
        {tab === 'patients' && (
          <div>
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
              ← Mon espace
            </Link>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Mes patients</h2>
              <p className="text-sm text-gray-500 mt-1">
                {clinic
                  ? "Animaux des patients ayant un rendez-vous confirmé ou terminé avec vous ou un confrère de votre cabinet — utile pour consulter un dossier si un collègue est absent."
                  : "Animaux des patients ayant un rendez-vous confirmé ou terminé avec vous."}
              </p>
            </div>
            {patientAnimals.length > 0 && (
              <input
                type="text"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Rechercher par nom d'animal ou de propriétaire..."
                className="input text-sm mb-4 max-w-md"
              />
            )}
            {clinicLoading || patientAnimalsLoading ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">Chargement...</p>
              </div>
            ) : patientAnimals.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <p className="text-3xl mb-3">🐾</p>
                <p className="text-gray-500 text-sm">Aucun animal suivi pour l'instant.</p>
              </div>
            ) : filteredPatientAnimals.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-gray-500 text-sm">Aucun résultat pour cette recherche.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {filteredPatientAnimals.map((a: any) => {
                  const isColleaguePatient = clinic && a.referentDoctorId && a.referentDoctorId !== doctor?.id
                  const referentName = isColleaguePatient
                    ? (() => {
                        const m: any = clinicMembers.find((cm: any) => cm.doctor_id === a.referentDoctorId)
                        const p = m?.doctors?.profiles
                        return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : ''
                      })()
                    : ''
                  return (
                    <Link key={a.id} to={`/animal/${a.id}`}
                      className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative">
                      {isColleaguePatient && (
                        <span className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full" title={`Suivi par ${referentName}`}>
                          🤝
                        </span>
                      )}
                      <div className="w-14 h-14 rounded-xl mx-auto mb-2 overflow-hidden bg-gray-100 flex items-center justify-center">
                        {a.avatar_url
                          ? <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                          : <span className="text-3xl">{SPECIES_EMOJI[a.species] ?? '🐾'}</span>
                        }
                      </div>
                      <p className="font-semibold text-sm text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.breed ?? a.species}</p>
                      <p className="text-xs text-sage-600 mt-1">{a.ownerName}</p>
                      {isColleaguePatient && referentName && (
                        <p className="text-xs text-amber-600 mt-0.5">Suivi par {referentName}</p>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TARIFS ── */}
        {tab === 'tarifs' && (
          <div className="max-w-2xl">
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
              ← Mon espace
            </Link>
            {/* En cabinet */}
            {clinic ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Tarifs du cabinet</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Chaque praticien de <strong>{clinic.name}</strong> inscrit ses propres tarifs
                    </p>
                  </div>
                  <button onClick={() => setAddingService(true)} className="btn-primary text-sm px-4 py-2">
                    + Ajouter mon tarif
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

                {servicesByDoctor.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-3xl mb-3">💰</p>
                    <p className="text-gray-500 text-sm">Aucune prestation renseignée pour ce cabinet.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {servicesByDoctor.map(group => (
                      <div key={group.doctorId} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="mb-3">
                          <p className="font-semibold text-gray-900">{group.name}</p>
                          {group.specialty && <p className="text-xs text-gray-400">{group.specialty}</p>}
                        </div>
                        <div className="space-y-2">
                          {group.services.map((service: any) => (
                            <div key={service.id} className="flex items-center justify-between border-t border-gray-50 pt-2 first:border-0 first:pt-0">
                              <div>
                                <p className="text-sm text-gray-800">{service.name}</p>
                                <p className="text-xs text-gray-400">{service.duration}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-base font-bold text-sage-600">
                                  {service.price !== null ? `${service.price} €` : 'Sur devis'}
                                </span>
                                {(group.doctorId === doctor?.id || isClinicAdmin) && (
                                  <button onClick={() => deleteClinicService.mutate({ id: service.id, clinicId: clinic.id })}
                                    className="text-gray-300 hover:text-red-400 transition-colors text-lg">✕</button>
                                )}
                              </div>
                            </div>
                          ))}
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
                      <button onClick={async () => {
                        if (!newService.name || !doctor) return
                        await addDoctorService.mutateAsync({
                          doctorId: doctor.id,
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

                {doctorServices.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-3xl mb-3">💰</p>
                    <p className="text-gray-500 text-sm">Aucune prestation renseignée.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {doctorServices.map((service: any) => (
                      <div key={service.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{service.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{service.duration}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-sage-600">
                            {service.price !== null ? `${service.price} €` : 'Sur devis'}
                          </span>
                          <button onClick={() => doctor && deleteDoctorService.mutate({ id: service.id, doctorId: doctor.id })}
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
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
              ← Mon espace
            </Link>
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
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setShowAddSlot(true); setSlotError('') }} className="btn-primary text-sm px-4 py-2">
                    + Ajouter un créneau
                  </button>
                </div>

                {showAddSlot && (
                  <div className="bg-white rounded-2xl p-5 mb-4 border-2 border-sage-200">
                    <h3 className="font-semibold text-sm text-gray-800 mb-3">Nouveau créneau</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Jour</label>
                        <select className="input text-sm" value={slotForm.day_of_week}
                          onChange={e => setSlotForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}>
                          {DAYS.map((day, i) => (
                            <option key={day} value={(i + 1) % 7}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Début</label>
                        <input type="time" className="input text-sm" value={slotForm.start_time}
                          onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fin</label>
                        <input type="time" className="input text-sm" value={slotForm.end_time}
                          onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} />
                      </div>
                    </div>
                    {slotError && <p className="text-red-500 text-sm mt-3">{slotError}</p>}
                    <div className="flex gap-2 mt-4">
                      <button onClick={async () => {
                        if (!doctor?.id) return
                        if (slotForm.start_time >= slotForm.end_time) {
                          setSlotError("L'heure de fin doit être après l'heure de début.")
                          return
                        }
                        setSlotError('')
                        try {
                          await createAvailability.mutateAsync({ doctor_id: doctor.id, ...slotForm })
                          setShowAddSlot(false)
                        } catch (e: any) {
                          setSlotError(e.message ?? "Erreur lors de l'ajout du créneau.")
                        }
                      }} disabled={createAvailability.isPending} className="btn-primary text-sm px-4 py-2">
                        {createAvailability.isPending ? 'Ajout...' : 'Ajouter'}
                      </button>
                      <button onClick={() => setShowAddSlot(false)} className="btn-secondary text-sm px-4 py-2">Annuler</button>
                    </div>
                  </div>
                )}

                {availabilities.length === 0 && !showAddSlot ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                    <p className="text-3xl mb-3">🗓️</p>
                    <p className="text-gray-500 text-sm">Vous n'avez pas encore renseigné vos disponibilités.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {DAYS.map((day, i) => {
                      const slots = availabilities.filter((a: any) => a.day_of_week === (i + 1) % 7)
                      return (
                        <div key={day} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                          <span className="font-medium text-gray-700 w-24">{day}</span>
                          <div className="flex-1 flex flex-wrap gap-2">
                            {slots.length === 0 ? (
                              <span className="text-sm text-gray-400">Indisponible</span>
                            ) : slots.map((s: any) => (
                              <span key={s.id} className="inline-flex items-center gap-1 bg-sage-50 text-sage-700 text-xs px-3 py-1 rounded-full">
                                {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                                <button
                                  onClick={() => deleteAvailability.mutate({ id: s.id, doctorId: doctor!.id })}
                                  className="text-sage-400 hover:text-red-500 transition-colors ml-1">✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Congés / indisponibilités */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">🌴 Congés & indisponibilités</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Gelez une période précise (vacances, formation...) : aucun créneau ne sera proposé aux patients sur ces dates.
                      </p>
                    </div>
                    <button onClick={() => { setShowAddBlocked(true); setBlockedError('') }} className="btn-secondary text-sm px-4 py-2 flex-shrink-0 ml-3">
                      + Ajouter une période
                    </button>
                  </div>

                  {showAddBlocked && (
                    <div className="bg-white rounded-2xl p-5 mb-4 border-2 border-sage-200">
                      <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle période d'indisponibilité</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Du</label>
                          <input type="date" className="input text-sm" value={blockedForm.start_date}
                            onChange={e => setBlockedForm(f => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Au</label>
                          <input type="date" className="input text-sm" value={blockedForm.end_date}
                            onChange={e => setBlockedForm(f => ({ ...f, end_date: e.target.value }))} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-500 mb-1">Motif (facultatif)</label>
                        <input className="input text-sm" value={blockedForm.reason}
                          onChange={e => setBlockedForm(f => ({ ...f, reason: e.target.value }))}
                          placeholder="Ex: Vacances, formation..." />
                      </div>
                      {blockedError && <p className="text-red-500 text-sm mt-3">{blockedError}</p>}
                      <div className="flex gap-2 mt-4">
                        <button onClick={async () => {
                          if (!doctor?.id) return
                          if (!blockedForm.start_date || !blockedForm.end_date) {
                            setBlockedError('Merci de renseigner les deux dates.')
                            return
                          }
                          if (blockedForm.start_date > blockedForm.end_date) {
                            setBlockedError('La date de fin doit être après la date de début.')
                            return
                          }
                          setBlockedError('')
                          try {
                            const start = new Date(blockedForm.start_date); start.setHours(0, 0, 0, 0)
                            const end = new Date(blockedForm.end_date); end.setHours(23, 59, 59, 999)
                            await createBlockedSlot.mutateAsync({
                              doctor_id: doctor.id,
                              start_at: start.toISOString(),
                              end_at: end.toISOString(),
                              reason: blockedForm.reason || undefined,
                            })
                            setShowAddBlocked(false)
                            setBlockedForm({ start_date: '', end_date: '', reason: '' })
                          } catch (e: any) {
                            setBlockedError(e.message ?? "Erreur lors de l'ajout de la période.")
                          }
                        }} disabled={createBlockedSlot.isPending} className="btn-primary text-sm px-4 py-2">
                          {createBlockedSlot.isPending ? 'Ajout...' : 'Ajouter'}
                        </button>
                        <button onClick={() => setShowAddBlocked(false)} className="btn-secondary text-sm px-4 py-2">Annuler</button>
                      </div>
                    </div>
                  )}

                  {blockedSlots.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune période d'indisponibilité programmée.</p>
                  ) : (
                    <div className="space-y-2">
                      {blockedSlots.map((b: any) => (
                        <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {format(new Date(b.start_at), 'd MMM yyyy', { locale: fr })} → {format(new Date(b.end_at), 'd MMM yyyy', { locale: fr })}
                            </p>
                            {b.reason && <p className="text-xs text-gray-400 mt-0.5">{b.reason}</p>}
                          </div>
                          <button
                            onClick={() => deleteBlockedSlot.mutate({ id: b.id, doctorId: doctor!.id })}
                            className="text-xs text-red-400 hover:text-red-500 flex-shrink-0 ml-3">Supprimer</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                      {removeMemberError && <p className="text-red-500 text-sm mb-3">{removeMemberError}</p>}
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
                            {clinic.owner_id === m.doctors?.user_id ? (
                              <span className="ml-auto text-xs bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full">Admin</span>
                            ) : (
                              isClinicAdmin && (
                                <button
                                  onClick={async () => {
                                    setRemoveMemberError('')
                                    try {
                                      await removeClinicMember.mutateAsync({ clinicMemberId: m.id, clinicId: clinic.id })
                                    } catch (e: any) {
                                      setRemoveMemberError(e.message ?? 'Erreur lors du retrait du membre.')
                                    }
                                  }}
                                  disabled={removeClinicMember.isPending}
                                  className="ml-auto text-xs text-red-500 hover:underline">
                                  Retirer
                                </button>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Secrétariat */}
                    {isClinicAdmin && (
                      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-semibold text-gray-900 mb-1">Secrétariat</h3>
                        <p className="text-xs text-gray-400 mb-4">
                          Donnez un accès dédié à votre équipe administrative, sans partager vos identifiants.
                          L'email ci-dessous ne sert qu'à l'envoi : la connexion se fait avec un identifiant généré,
                          pas avec cette adresse.
                        </p>

                        <div className="flex gap-2 mb-4">
                          <input type="email" className="input text-sm flex-1"
                            placeholder="email@secretaire.fr"
                            value={secretaryEmail}
                            onChange={e => { setSecretaryEmail(e.target.value); setSecretaryInviteSuccess(false) }} />
                          <button
                            onClick={async () => {
                              if (!secretaryEmail || !clinic?.id) return
                              setSecretaryInviteError('')
                              setSecretaryInviteSuccess(false)
                              try {
                                const result = await inviteSecretary.mutateAsync({ clinicId: clinic.id, email: secretaryEmail })
                                setSecretaryEmail('')
                                setSecretaryLoginIdentifier(result?.loginIdentifier ?? '')
                                setSecretaryInviteSuccess(true)
                              } catch (e: any) {
                                setSecretaryInviteError(e.message ?? "Erreur lors de l'envoi des identifiants.")
                              }
                            }}
                            disabled={inviteSecretary.isPending}
                            className="btn-primary text-sm px-4 py-2 whitespace-nowrap">
                            {inviteSecretary.isPending ? 'Envoi...' : 'Envoyer les identifiants'}
                          </button>
                        </div>
                        {secretaryInviteError && <p className="text-red-500 text-sm mb-3">{secretaryInviteError}</p>}
                        {secretaryInviteSuccess && (
                          <p className="text-sage-600 text-sm mb-3">
                            ✓ Identifiants envoyés par email.
                            {secretaryLoginIdentifier && <> Identifiant de connexion : <strong>{secretaryLoginIdentifier}</strong></>}
                          </p>
                        )}

                        {clinicStaff.length > 0 && (
                          <div className="space-y-3 pt-3 border-t border-gray-100">
                            {clinicStaff.map((s: any) => (
                              <div key={s.user_id} className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-bold text-sm">
                                  {s.first_name?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-800">
                                    {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.email}
                                  </p>
                                  <p className="text-xs text-gray-400">{s.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sélecteur de jour */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">Calendrier du cabinet</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => setCalendarWeekOffset(w => w - 1)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">‹</button>
                          <span className="text-xs text-gray-500 min-w-[130px] text-center">
                            {format(calendarWeekDays[0], 'd MMM', { locale: fr })} – {format(calendarWeekDays[6], 'd MMM yyyy', { locale: fr })}
                          </span>
                          <button onClick={() => setCalendarWeekOffset(w => w + 1)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">›</button>
                          {calendarWeekOffset !== 0 && (
                            <button onClick={() => { setCalendarWeekOffset(0); setSelectedCalendarDay(new Date()) }}
                              className="text-xs text-sage-600 hover:underline ml-1">Aujourd'hui</button>
                          )}
                        </div>
                      </div>
                      {clinicApptsError && (
                        <p className="text-red-500 text-xs mb-3">
                          Erreur de chargement des RDV du cabinet : {(clinicApptsError as any).message}
                        </p>
                      )}
                      <div className="grid grid-cols-7 gap-1.5">
                        {calendarWeekDays.map(d => {
                          const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
                          const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)
                          const anyoneOnLeave = clinicBlockedAll.some((b: any) =>
                            new Date(b.start_at) <= dayEnd && new Date(b.end_at) >= dayStart
                          )
                          const isSelected = isSameDay(d, selectedCalendarDay)
                          return (
                            <button key={d.toISOString()} onClick={() => setSelectedCalendarDay(d)}
                              className={`rounded-xl py-2 text-xs font-medium transition-colors relative
                                ${isSelected ? 'bg-sage-500 text-white' : isSameDay(d, new Date()) ? 'bg-sage-50 text-sage-600 hover:bg-sage-100' : 'text-gray-500 hover:bg-gray-50'}`}>
                              <div>{format(d, 'EEE', { locale: fr })}</div>
                              <div className={`font-normal ${isSelected ? 'text-sage-100' : 'text-gray-400'}`}>{format(d, 'd')}</div>
                              {anyoneOnLeave && <span className="absolute top-1 right-1.5 text-[10px]">🌴</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Calendrier horaire du jour sélectionné : tous les
                        créneaux, un praticien par colonne, RDV positionnés
                        à leur heure. */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-x-auto">
                      <h3 className="font-semibold text-gray-900 mb-4">
                        {format(selectedCalendarDay, 'EEEE d MMMM', { locale: fr })}
                      </h3>
                      {(() => {
                        const dayOfWeek = selectedCalendarDay.getDay()
                        const dayStart = new Date(selectedCalendarDay); dayStart.setHours(0, 0, 0, 0)
                        const dayEnd = new Date(selectedCalendarDay); dayEnd.setHours(23, 59, 59, 999)
                        const toMinutes = (t: string) => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi }
                        const minutesOfDay = (dt: Date) => dt.getHours() * 60 + dt.getMinutes()

                        const daySlotsAll = clinicAvailabilities.filter((av: any) => av.day_of_week === dayOfWeek)
                        const dayApptsAll = clinicAppts.filter((a: any) =>
                          isSameDay(new Date(a.start_at), selectedCalendarDay) && a.status !== 'cancelled'
                        )
                        const bounds = [
                          ...daySlotsAll.map((s: any) => toMinutes(s.start_time)),
                          ...daySlotsAll.map((s: any) => toMinutes(s.end_time)),
                          ...dayApptsAll.flatMap((a: any) => [minutesOfDay(new Date(a.start_at)), minutesOfDay(new Date(a.end_at))]),
                        ]
                        const gridStart = bounds.length > 0 ? Math.floor(Math.min(...bounds) / 30) * 30 : 8 * 60
                        const gridEnd   = bounds.length > 0 ? Math.ceil(Math.max(...bounds) / 30) * 30 : 19 * 60
                        const timeSlots: number[] = []
                        for (let t = gridStart; t < gridEnd; t += 30) timeSlots.push(t)

                        if (clinicMembers.length === 0) {
                          return <p className="text-sm text-gray-400 text-center py-6">Aucun membre dans le cabinet.</p>
                        }

                        return (
                          <table className="w-full text-xs border-collapse min-w-[560px]">
                            <thead>
                              <tr>
                                <th className="text-left text-gray-400 font-medium pb-2 pr-2 w-14">Heure</th>
                                {clinicMembers.map((m: any) => (
                                  <th key={m.id} className="text-center text-gray-600 font-medium pb-2 px-1">
                                    {`${m.doctors?.profiles?.first_name ?? ''} ${m.doctors?.profiles?.last_name ?? ''}`.trim()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {timeSlots.map(t => (
                                <tr key={t} className="border-t border-gray-50">
                                  <td className="py-1 pr-2 text-gray-400 align-top whitespace-nowrap">
                                    {String(Math.floor(t / 60)).padStart(2, '0')}:{String(t % 60).padStart(2, '0')}
                                  </td>
                                  {clinicMembers.map((m: any) => {
                                    const onLeave = clinicBlockedAll.some((b: any) =>
                                      b.doctor_id === m.doctor_id &&
                                      new Date(b.start_at) <= dayEnd && new Date(b.end_at) >= dayStart
                                    )
                                    const memberSlots = daySlotsAll.filter((av: any) => av.doctor_id === m.doctor_id)
                                    const inHours = memberSlots.some((s: any) => t >= toMinutes(s.start_time) && t < toMinutes(s.end_time))
                                    const appt = dayApptsAll.find((a: any) => {
                                      if (a.doctor_id !== m.doctor_id) return false
                                      const s = minutesOfDay(new Date(a.start_at))
                                      const e = minutesOfDay(new Date(a.end_at))
                                      return t < e && t + 30 > s
                                    })
                                    const apptStartsHere = appt && minutesOfDay(new Date(appt.start_at)) >= t && minutesOfDay(new Date(appt.start_at)) < t + 30

                                    if (onLeave) {
                                      return (
                                        <td key={m.id} className="py-1 px-1 text-center bg-amber-50">
                                          {t === timeSlots[0] && <span className="text-amber-600">🌴</span>}
                                        </td>
                                      )
                                    }
                                    if (appt) {
                                      const statusColor =
                                        appt.status === 'pending' ? 'bg-amber-400' :
                                        appt.status === 'completed' ? 'bg-gray-400' :
                                        appt.status === 'no_show' ? 'bg-red-300' : 'bg-sage-500'
                                      const patientName = `${appt.patientProfile?.first_name ?? ''} ${appt.patientProfile?.last_name ?? ''}`.trim()
                                      const animalNames = (appt.animals ?? []).map((an: any) => an.name).join(', ')
                                      return (
                                        <td key={m.id} className="py-0.5 px-0.5 align-top">
                                          <button onClick={() => setSelectedApptDetail(appt)}
                                            className={`${statusColor} text-white rounded-md px-1.5 py-0.5 truncate w-full text-left hover:opacity-90 transition-opacity cursor-pointer`}
                                            title={`${patientName}${animalNames ? ' · ' + animalNames : ''}${appt.reason ? ' · ' + appt.reason : ''}`}>
                                            {apptStartsHere ? (
                                              <span className="font-medium">{patientName || 'Patient'}{animalNames ? ` · ${animalNames}` : ''}</span>
                                            ) : '···'}
                                          </button>
                                        </td>
                                      )
                                    }
                                    return (
                                      <td key={m.id} className={`py-1 px-1 text-center ${inHours ? 'bg-white' : 'bg-gray-50'}`}>
                                        {inHours ? '' : <span className="text-gray-200">·</span>}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      })()}
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
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors">
              ← Mon espace
            </Link>

            {/* Espace secrétariat : compte à part entière avec ses propres
                identifiants — ce lien renvoie vers la page de connexion,
                pas vers un dashboard partagé avec cette session (voir
                invite-clinic-secretary). */}
            <Link to="/login"
              className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <span className="text-xl">🏥</span>
              <span>
                <span className="block font-medium text-gray-800">Espace secrétariat</span>
                <span className="block text-xs text-gray-400">Se connecter avec les identifiants dédiés du cabinet</span>
              </span>
            </Link>

            {/* Profil du cabinet — réservé à l'admin (créateur) du cabinet.
                Un simple membre n'a pas à voir cette section : il ne peut
                de toute façon rien y modifier. */}
            {clinic && isClinicAdmin && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900">Profil du cabinet</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Visible par les patients sur la fiche du cabinet</p>
                </div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative w-16 h-16 flex-shrink-0 group">
                    <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center text-2xl overflow-hidden">
                      {clinic.logo_url
                        ? <img src={clinic.logo_url} className="w-full h-full object-cover" alt={clinic.name} />
                        : '🏥'}
                    </div>
                    <label className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-white text-xs font-medium">{clinicLogoUploading ? '...' : '📷'}</span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleClinicLogoUpload(f); e.target.value = '' }} />
                    </label>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Logo du cabinet</p>
                    <p className="text-xs text-gray-400">Survolez la photo pour la changer</p>
                    {clinicLogoError && <p className="text-red-500 text-xs mt-1">{clinicLogoError}</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du cabinet</label>
                    <input className="input" defaultValue={clinic.name} id="clinic-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                      <input className="input" defaultValue={clinic.city ?? ''} id="clinic-city" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                      <input className="input" defaultValue={clinic.address ?? ''} id="clinic-address" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone du cabinet</label>
                    <input className="input" defaultValue={clinic.phone ?? ''} id="clinic-phone" />
                  </div>
                  <button onClick={async () => {
                    const name    = (document.getElementById('clinic-name') as HTMLInputElement).value
                    const city    = (document.getElementById('clinic-city') as HTMLInputElement).value
                    const address = (document.getElementById('clinic-address') as HTMLInputElement).value
                    const phone   = (document.getElementById('clinic-phone') as HTMLInputElement).value
                    await updateClinic.mutateAsync({ id: clinic.id, name, city, address, phone })
                  }} className="btn-primary w-full">
                    {updateClinic.isPending ? 'Enregistrement...' : 'Enregistrer les modifications du cabinet'}
                  </button>
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
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 flex-shrink-0 group">
                  <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center text-2xl overflow-hidden">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Photo de profil" />
                      : '👤'}
                  </div>
                  <label className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <span className="text-white text-xs font-medium">{photoUploading ? '...' : '📷'}</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Ma photo</p>
                  <p className="text-xs text-gray-400">Survolez la photo pour la changer</p>
                  {photoError && <p className="text-red-500 text-xs mt-1">{photoError}</p>}
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <input className="input" value={profileForm.first_name}
                      onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input className="input" value={profileForm.last_name}
                      onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité / Métier</label>
                  <select className="input" value={profileForm.specialty}
                    onChange={e => setProfileForm(f => ({ ...f, specialty: e.target.value }))}>
                    <option value="" disabled>Choisir un métier</option>
                    {PRACTITIONER_TYPES.map(t => (
                      <option key={t.id} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {!clinic && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                      <input className="input" value={profileForm.city}
                        onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                      <input className="input" value={profileForm.address}
                        onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                  </div>
                )}
                {/* Espèces acceptées et déplacement à domicile — propres au
                    praticien lui-même, indépendants du cabinet (contrairement
                    à ville/adresse ci-dessus). */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Espèces acceptées</label>
                  <div className="flex flex-wrap gap-2">
                    {PRACTICE_SPECIES_OPTIONS.map(opt => (
                      <button type="button" key={opt.id} onClick={() => toggleProfileSpecies(opt.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          profileForm.accepted_species.includes(opt.id)
                            ? 'bg-sage-500 border-sage-500 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-sage-300'
                        }`}>
                        {opt.icon} {opt.id}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={profileForm.home_visit}
                    onChange={e => setProfileForm(f => ({ ...f, home_visit: e.target.checked }))}
                    className="accent-sage-500 w-4 h-4" />
                  🏠 Je me déplace à domicile
                </label>
                {/* La bio reste éditable même pour un membre de cabinet — seules
                    ville/adresse dépendent du cabinet, pas la présentation
                    personnelle du praticien. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Présentation</label>
                  <RichTextEditor value={profileForm.bio}
                    onChange={bio => setProfileForm(f => ({ ...f, bio }))}
                    placeholder="Décrivez votre activité, votre expérience..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input className="input" value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                {profileError && <p className="text-red-500 text-sm">{profileError}</p>}
                {profileSaved && <p className="text-sage-600 text-sm">✓ Informations enregistrées.</p>}
                <button onClick={submitProfile} disabled={updateProfile.isPending || updateDoctorInfo.isPending} className="btn-primary w-full">
                  {(updateProfile.isPending || updateDoctorInfo.isPending) ? 'Enregistrement...' : 'Enregistrer mes informations'}
                </button>
              </div>
            </div>

            {/* VÉRIFICATION DU PROFIL — dépôt des documents justificatifs */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-900">Vérification de mon profil</h2>
                {doctor?.verification_status === 'verified' && (
                  <span className="badge bg-sage-100 text-sage-700">✓ Vérifié</span>
                )}
                {doctor?.verification_status === 'pending' && (
                  <span className="badge bg-amber-100 text-amber-700">En attente</span>
                )}
                {doctor?.verification_status === 'rejected' && (
                  <span className="badge bg-red-100 text-red-700">Rejeté</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Déposez vos documents justificatifs (diplôme, carte professionnelle, numéro d&apos;ordre...) pour
                que votre profil soit vérifié et visible dans les résultats de recherche.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <select className="input text-sm w-auto" value={verificationDocType}
                  onChange={e => setVerificationDocType(e.target.value)}>
                  <option>Diplôme</option>
                  <option>Carte professionnelle / Numéro d&apos;ordre</option>
                  <option>Pièce d&apos;identité</option>
                  <option>Autre</option>
                </select>
                <label className="btn-secondary text-sm cursor-pointer">
                  {verificationUploading ? 'Envoi...' : '+ Ajouter un document'}
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={verificationUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadVerificationDocument(f); e.target.value = '' }} />
                </label>
              </div>
              {verificationError && <p className="text-red-500 text-xs mb-3">{verificationError}</p>}

              {verificationDocuments.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun document déposé pour l&apos;instant.</p>
              ) : (
                <ul className="space-y-2">
                  {verificationDocuments.map((doc: any) => (
                    <li key={doc.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sage-600 hover:underline">
                        📄 {doc.document_type} — {doc.file_name}
                      </a>
                      <button onClick={() => deleteVerificationDocument.mutate({ id: doc.id, doctorId: doctor!.id })}
                        className="text-gray-300 hover:text-red-500 transition-colors" title="Supprimer">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* EXPORT DES DONNÉES — droit à la portabilité (RGPD art. 20) */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-1">Mes données</h2>
              <p className="text-xs text-gray-500 mb-4">
                Téléchargez une copie de toutes vos données personnelles (profil, patients, rendez-vous, messages,
                avis…) dans un fichier structuré.
              </p>
              {exportError && <p className="text-red-500 text-xs mb-3">{exportError}</p>}
              <button onClick={handleExportData} disabled={exportMyData.isPending}
                className="btn-secondary text-sm">
                {exportMyData.isPending ? 'Préparation...' : '⬇️ Télécharger mes données'}
              </button>
            </div>

            {/* ZONE DE DANGER */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100">
              <h2 className="font-semibold text-red-600 mb-1">Zone de danger</h2>
              <p className="text-xs text-gray-500 mb-4">
                La suppression de votre compte est définitive : profil, rendez-vous, disponibilités,
                messages, avis{clinic ? (isClinicAdmin ? ', votre cabinet (les autres membres perdront l\'accès à l\'agenda partagé)' : ', votre adhésion au cabinet') : ''} — tout sera effacé sans possibilité de retour en arrière.
              </p>
              {deleteAccountError && <p className="text-red-500 text-sm mb-3">{deleteAccountError}</p>}
              {!confirmDeleteAccount ? (
                <button onClick={() => setConfirmDeleteAccount(true)}
                  className="text-sm text-red-500 hover:underline font-medium">
                  Supprimer mon compte
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 font-medium">Es-tu sûr(e) ? Cette action est irréversible.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDeleteAccount} disabled={deleteAccount.isPending}
                      className="btn-primary bg-red-500 hover:bg-red-600 text-sm px-4 py-2">
                      {deleteAccount.isPending ? 'Suppression...' : 'Oui, supprimer définitivement'}
                    </button>
                    <button onClick={() => setConfirmDeleteAccount(false)} className="btn-secondary text-sm px-4 py-2">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === 'messages' && (
          <div>
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
              ← Mon espace
            </Link>
            <div className="flex gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
            {/* Contacts */}
            <aside className="w-64 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Conversations</p>
                <button onClick={() => { setShowNewMsg(true); setSearchQuery('') }}
                  className="text-xs bg-sage-500 text-white px-3 py-1.5 rounded-lg hover:bg-sage-600 transition-colors">
                  + Nouveau
                </button>
              </div>

              {/* Recherche nouveau message — limitée aux patients avec RDV */}
              {showNewMsg && (
                <div className="p-3 border-b border-gray-100 bg-sage-50">
                  <p className="text-xs font-medium text-gray-600 mb-2">Nouveau message</p>
                  <input
                    className="input text-sm w-full"
                    placeholder="Rechercher parmi vos patients..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {newMsgResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                      {newMsgResults.map(r => (
                        <button key={r.user_id}
                          onClick={() => {
                            setSelectedUserId(r.user_id)
                            unhideConversation(r.user_id)
                            setShowNewMsg(false)
                            setSearchQuery('')
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
                        ? "Aucun patient n'a encore eu de rendez-vous avec vous."
                        : 'Aucun résultat.'}
                    </p>
                  )}
                  <button onClick={() => setShowNewMsg(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-2 w-full text-center">
                    Annuler
                  </button>
                </div>
              )}

              <div className="p-3 border-b border-gray-100">
                <input
                  type="text"
                  value={messageSearch}
                  onChange={e => setMessageSearch(e.target.value)}
                  placeholder="Chercher par nom (patient ou animal)..."
                  className="input text-xs py-1.5"
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {sortedContacts.length === 0 ? (
                  <p className="text-xs text-gray-400 p-4 text-center">Aucune conversation pour l'instant.</p>
                ) : filteredMessageContacts.length === 0 ? (
                  <p className="text-xs text-gray-400 p-4 text-center">Aucun résultat.</p>
                ) : filteredMessageContacts.map((c: any) => (
                  <div key={c.user_id} onClick={() => setSelectedUserId(c.user_id)}
                    className={`group w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer
                      ${selectedUserId === c.user_id ? 'bg-sage-50' : ''}`}>
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
                    {confirmDeleteConvId === c.user_id ? (
                      <span className="flex-shrink-0 flex flex-col items-end gap-0.5 text-xs">
                        <button onClick={e => { e.stopPropagation(); handleDeleteConversation(c.user_id) }}
                          className="text-red-500 hover:underline font-semibold">Supprimer</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteConvId(null) }}
                          className="text-gray-400 hover:underline">Annuler</button>
                      </span>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteConvId(c.user_id) }}
                        className="flex-shrink-0 text-xs text-gray-400 hover:text-red-500 hover:underline transition-colors"
                        title="Supprimer la conversation">
                        Suppr.
                      </button>
                    )}
                  </div>
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
                      {sortedContacts.find((c: any) => c.user_id === selectedUserId)?.name}
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
                    unhideConversation(selectedUserId)
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
          </div>
        )}

        {/* ── AVIS ── */}
        {tab === 'avis' && (
          <div className="max-w-2xl">
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
              ← Mon espace
            </Link>
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
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {r.profiles?.first_name
                            ? `${r.profiles.first_name}${r.profiles.last_name ? ' ' + r.profiles.last_name[0].toUpperCase() + '.' : ''}`
                            : 'Patient anonyme'}
                        </span>
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

        {tab === 'stats' && (
          <div className="max-w-3xl">
            <Link to="/dashboard/doctor?tab=home"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sage-600 transition-colors mb-4">
              ← Mon espace
            </Link>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Statistiques</h2>
            <p className="text-sm text-gray-500 mb-6">Un aperçu de votre activité sur la plateforme.</p>

            {hasUnclosedPastAppts && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl mb-6">
                💡 Vos statistiques resteront vides tant que vos rendez-vous passés ne sont pas clôturés.
                Marquez-les en <strong>Terminé</strong> ou <strong>Absent(e)</strong> (bouton sur chaque RDV,
                onglet Mon espace) pour voir apparaître revenu et taux de no-show.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-sage-600">{totalRevenue.toLocaleString('fr-FR')} €</p>
                <p className="text-xs text-gray-500 mt-1">Revenu total (RDV terminés)</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-sage-600">{revenueLast30Days.toLocaleString('fr-FR')} €</p>
                <p className="text-xs text-gray-500 mt-1">Revenu (30 derniers jours)</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className={`text-2xl font-bold ${noShowRate !== null && noShowRate > 15 ? 'text-red-500' : 'text-sage-600'}`}>
                  {noShowRate !== null ? `${noShowRate}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Taux de no-show</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-sage-600">{cancellationRate !== null ? `${cancellationRate}%` : '—'}</p>
                <p className="text-xs text-gray-500 mt-1">Taux d'annulation</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-900">Taux de remplissage (30 derniers jours)</h3>
                <span className="text-lg font-bold text-sage-600">{fillRate !== null ? `${fillRate}%` : '—'}</span>
              </div>
              {fillRate !== null ? (
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sage-500 rounded-full transition-all" style={{ width: `${fillRate}%` }} />
                </div>
              ) : (
                <p className="text-xs text-gray-400">Renseignez vos disponibilités pour voir cette statistique.</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Estimation à partir de vos disponibilités récurrentes — ne tient pas compte des congés posés.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Détail d'un RDV cliqué dans le calendrier partagé du cabinet —
          accessible même pour le RDV d'un confrère, pour pouvoir le
          couvrir (heure, patient/propriétaire, animal, documents joints). */}
      {selectedApptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedApptDetail(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Détail du rendez-vous</h3>
              <button onClick={() => setSelectedApptDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date & heure</span>
                <span className="font-medium text-gray-900">
                  {format(new Date(selectedApptDetail.start_at), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Praticien</span>
                <span className="font-medium text-gray-900">
                  {`${selectedApptDetail.doctors?.profiles?.first_name ?? ''} ${selectedApptDetail.doctors?.profiles?.last_name ?? ''}`.trim()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Propriétaire</span>
                <span className="font-medium text-gray-900">
                  {`${selectedApptDetail.patientProfile?.first_name ?? ''} ${selectedApptDetail.patientProfile?.last_name ?? ''}`.trim() || '—'}
                </span>
              </div>
              {(selectedApptDetail.animals ?? []).length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{selectedApptDetail.animals.length > 1 ? 'Animaux' : 'Animal'}</span>
                  <span className="font-medium text-gray-900">
                    {selectedApptDetail.animals.map((an: any) => an.name).join(', ')}
                  </span>
                </div>
              )}
              {selectedApptDetail.reason && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Motif</span>
                  <span className="font-medium text-gray-900">{selectedApptDetail.reason}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Statut</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${selectedApptDetail.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    selectedApptDetail.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                    selectedApptDetail.status === 'cancelled' || selectedApptDetail.status === 'no_show' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-500'}`}>
                  {selectedApptDetail.status === 'confirmed' ? 'Confirmé' : selectedApptDetail.status === 'pending' ? 'En attente' :
                    selectedApptDetail.status === 'completed' ? 'Terminé' : selectedApptDetail.status === 'no_show' ? 'Absent(e)' :
                    selectedApptDetail.status === 'cancelled' ? 'Annulé' : selectedApptDetail.status}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">📎 Documents joints</p>
              {selectedApptDocuments.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun document joint à ce RDV.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedApptDocuments.map((d: any) => (
                    <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-sage-600 hover:underline bg-gray-50 rounded-lg px-3 py-2">
                      📄 {d.file_name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
