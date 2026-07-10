// src/hooks/useData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import type { SearchFilters, Appointment, AppointmentStatus } from '@/types'
import { addMinutes } from 'date-fns'

export function useDoctors(filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ['doctors', filters],
    queryFn: async () => {
      let q = supabase
        .from('doctors')
        .select('*, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url)')
      if (filters.specialty) q = q.ilike('specialty', `%${filters.specialty}%`)
      if (filters.city)      q = q.ilike('city', `%${filters.city}%`)
      if (filters.maxPrice)  q = q.lte('consultation_price', filters.maxPrice)
      if (filters.minRating) q = q.gte('average_rating', filters.minRating)
      const { data, error } = await q.order('average_rating', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useDoctor(id: string) {
  return useQuery({
    queryKey: ['doctor', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url, phone)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCurrentDoctor() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['currentDoctor', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!user && user.role === 'doctor',
  })
}

export function useAvailabilities(doctorId: string) {
  return useQuery({
    queryKey: ['availabilities', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availabilities')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('is_active', true)
        .order('day_of_week')
      if (error) throw error
      return data
    },
    enabled: !!doctorId,
  })
}

export function useAvailableSlots(doctorId: string, date: Date | null) {
  return useQuery({
    queryKey: ['slots', doctorId, date?.toDateString()],
    queryFn: async () => {
      if (!date || !doctorId) return []
      const dayOfWeek = date.getDay()
      const { data: avail } = await supabase
        .from('availabilities')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
      if (!avail || avail.length === 0) return []

      // Bornes de la journée en heure LOCALE, converties en instants UTC
      // corrects via toISOString() (évite les décalages de fuseau horaire).
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
      const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999)

      // Passe par une RPC plutôt qu'une requête directe sur `appointments` :
      // la policy RLS "patient voit les siens" limite un patient à SES
      // propres RDV, donc il ne pouvait jamais voir les créneaux réservés
      // par un AUTRE patient — ceux-ci réapparaissaient comme disponibles.
      const { data: booked, error: bookedErr } = await supabase.rpc('get_booked_slots', {
        p_doctor_id: doctorId,
        p_from: dayStart.toISOString(),
        p_to: dayEnd.toISOString(),
      })
      if (bookedErr) throw bookedErr
      const bookedTimes = new Set((booked || []).map((a: any) => new Date(a.start_at).getTime()))

      // Périodes de congés/indisponibilités posées par le praticien
      // (blocked_slots) : on exclut tout créneau qui tombe dedans.
      const { data: blocked } = await supabase
        .from('blocked_slots')
        .select('start_at, end_at')
        .eq('doctor_id', doctorId)
        .lt('start_at', dayEnd.toISOString())
        .gt('end_at', dayStart.toISOString())
      const blockedRanges = (blocked || []).map((b: any) => ({
        start: new Date(b.start_at).getTime(),
        end: new Date(b.end_at).getTime(),
      }))

      const slots: Date[] = []
      for (const a of avail) {
        const [sh, sm] = a.start_time.split(':').map(Number)
        const [eh, em] = a.end_time.split(':').map(Number)
        let cur = new Date(date)
        cur.setHours(sh, sm, 0, 0)
        const end = new Date(date)
        end.setHours(eh, em, 0, 0)
        while (cur < end) {
          const t = cur.getTime()
          const isBlocked = blockedRanges.some(r => t >= r.start && t < r.end)
          if (!bookedTimes.has(t) && !isBlocked) slots.push(new Date(cur))
          cur = addMinutes(cur, a.slot_duration_minutes)
        }
      }
      return slots
    },
    enabled: !!doctorId && !!date,
  })
}

export function useCreateAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (avail: {
      doctor_id: string
      day_of_week: number
      start_time: string
      end_time: string
      slot_duration_minutes?: number
    }) => {
      const { error } = await supabase
        .from('availabilities')
        .insert({ slot_duration_minutes: 30, is_active: true, ...avail })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['availabilities', vars.doctor_id] }),
  })
}

export function useDeleteAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; doctorId: string }) => {
      const { error } = await supabase.from('availabilities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['availabilities', vars.doctorId] }),
  })
}

// ── CONGÉS / INDISPONIBILITÉS (blocked_slots) ────────────────────────────────
// Permet à un praticien de geler une période précise (vacances, etc.), par-
// dessus son planning récurrent hebdomadaire.

export function useBlockedSlots(doctorId?: string) {
  return useQuery({
    queryKey: ['blocked-slots', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .eq('doctor_id', doctorId!)
        .order('start_at')
      if (error) throw error
      return data
    },
    enabled: !!doctorId,
  })
}

export function useCreateBlockedSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (slot: { doctor_id: string; start_at: string; end_at: string; reason?: string }) => {
      const { error } = await supabase.from('blocked_slots').insert(slot)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-slots', vars.doctor_id] })
      qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}

export function useDeleteBlockedSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; doctorId: string }) => {
      const { error } = await supabase.from('blocked_slots').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-slots', vars.doctorId] })
      qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}

export function usePatientAppointments() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['appointments', 'patient', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors!inner(specialty, city, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url)), reviews(id, rating, comment)')
        .eq('patient_id', user!.id)
        .order('start_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export function useDoctorAppointments(doctorId?: string) {
  return useQuery({
    queryKey: ['appointments', 'doctor', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, users!patient_id(id, email, profiles(first_name, last_name, avatar_url, phone)), appointment_animals(animals(id, name, species, avatar_url))')
        .eq('doctor_id', doctorId!)
        .order('start_at', { ascending: true })
      if (error) throw error
      // Aligne la forme des données sur le type Appointment : profiles au
      // niveau racine, et animaux à plat (un RDV peut concerner plusieurs animaux).
      return (data ?? []).map((a: any) => ({
        ...a,
        profiles: a.users?.profiles,
        animals: (a.appointment_animals ?? []).map((link: any) => link.animals).filter(Boolean),
      }))
    },
    enabled: !!doctorId,
  })
}

export function useCreateAppointment() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (data: {
      doctor_id: string
      start_at: string
      end_at: string
      reason?: string
      animal_ids?: string[]
    }) => {
      const { animal_ids, ...apptData } = data
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({ ...apptData, patient_id: user!.id, status: 'confirmed' })
        .select()
        .single()
      if (error) throw error

      // Lie le(s) animal(aux) choisi(s) au RDV (table de liaison many-to-many)
      if (animal_ids && animal_ids.length > 0) {
        const { error: linkError } = await supabase
          .from('appointment_animals')
          .insert(animal_ids.map(animal_id => ({ appointment_id: appt.id, animal_id })))
        if (linkError) throw linkError
      }

      return appt
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}

// Tous les animaux des patients d'un praticien (RDV confirmé ou terminé)
export function useDoctorPatientAnimals(doctorId?: string) {
  return useQuery({
    queryKey: ['doctor-patient-animals', doctorId],
    queryFn: async () => {
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', doctorId!)
        .in('status', ['confirmed', 'completed'])
      if (apptErr) throw apptErr

      const patientIds = [...new Set((appts ?? []).map((a: any) => a.patient_id))]
      if (patientIds.length === 0) return []

      // Requête directe sur `profiles` (policy RLS "médecin voit ses
      // patients") plutôt qu'un embed via `users` : aucune policy RLS ne
      // permet à un praticien de lire la ligne `users` d'un autre
      // utilisateur, donc l'embed users!patient_id(...) renvoyait null
      // silencieusement et aucun animal ne remontait jamais.
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', patientIds)
      if (profErr) throw profErr

      const ownerNames = new Map<string, string>()
      ;(profilesData ?? []).forEach((p: any) => {
        ownerNames.set(p.user_id, `${p.first_name} ${p.last_name}`.trim())
      })

      const { data: animals, error: animalErr } = await supabase
        .from('animals')
        .select('*')
        .in('owner_id', patientIds)
        .order('name')
      if (animalErr) throw animalErr

      return (animals ?? []).map((an: any) => ({ ...an, ownerName: ownerNames.get(an.owner_id) ?? '' }))
    },
    enabled: !!doctorId,
  })
}

// Profil du propriétaire d'un animal (accessible au praticien via RLS)
export function useAnimalOwner(userId?: string) {
  return useQuery({
    queryKey: ['animal-owner-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('user_id', userId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: AppointmentStatus; notes?: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status, notes, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

export function useDoctorReviews(doctorId: string) {
  return useQuery({
    queryKey: ['reviews', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, profiles!reviews_patient_id_profiles_fkey(first_name, last_name, avatar_url)')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!doctorId,
  })
}

export function useCreateReview() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async ({ appointmentId, doctorId, rating, comment }: {
      appointmentId?: string
      doctorId: string
      rating: number
      comment?: string
    }) => {
      // Un patient peut laisser plusieurs avis sur un même praticien
      // (indépendant de tout RDV précis) : simple insertion à chaque envoi.
      const { error } = await supabase.from('reviews').insert({
        appointment_id: appointmentId,
        doctor_id: doctorId,
        patient_id: user!.id,
        rating,
        comment: comment || undefined,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['reviews'] })
      qc.invalidateQueries({ queryKey: ['my-review', vars.doctorId] })
    },
  })
}


export function useConversation(otherUserId: string) {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['messages', user?.id, otherUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user!.id})`)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!user && !!otherUserId,
    refetchInterval: 5000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async ({ receiverId, content, appointmentId }: {
      receiverId: string; content: string; appointmentId?: string
    }) => {
      const { error } = await supabase.from('messages').insert({
        sender_id: user!.id,
        receiver_id: receiverId,
        content,
        appointment_id: appointmentId,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', user?.id, vars.receiverId] })
      qc.invalidateQueries({ queryKey: ['message-summaries'] })
    },
  })
}

// Résumé par contact (dernier message + nombre de non-lus), pour trier et
// signaler les nouvelles conversations dans la liste sans avoir à chercher
// manuellement la personne qui vient d'écrire.
// Construit la liste des conversations directement depuis la table
// `messages` (via une RPC SECURITY DEFINER) plutôt que depuis les RDV : plus
// fiable, résout aussi le prénom/nom de l'interlocuteur sans dépendre des
// policies RLS sur `profiles`/`users` qui bloquaient parfois silencieusement
// certains embeds.
export function useConversationPartners() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['conversation-partners', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conversation_partners')
      if (error) throw error
      return (data ?? []) as {
        user_id: string
        first_name: string
        last_name: string
        avatar_url: string | null
        last_message_at: string
        last_message_content: string
        unread_count: number
      }[]
    },
    enabled: !!user,
    refetchInterval: 5000,
  })
}

export function useMarkConversationRead() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('receiver_id', user!.id)
        .eq('sender_id', otherUserId)
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation-partners'] }),
  })
}

// Supprime l'intégralité d'une conversation (messages dans les deux sens).
export function useDeleteConversation() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user!.id})`)
      if (error) throw error
    },
    onSuccess: (_, otherUserId) => {
      qc.invalidateQueries({ queryKey: ['conversation-partners'] })
      qc.invalidateQueries({ queryKey: ['messages', user?.id, otherUserId] })
    },
  })
}

export function useNotifications() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteAllNotifications() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').delete().eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useSpecialties() {
  return useQuery({
    queryKey: ['specialties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('specialties').select('name').order('name')
      if (error) throw error
      return data.map(s => s.name)
    },
    staleTime: Infinity,
  })
}

// ─── ANIMALS ─────────────────────────────────────────────────

export function useAnimals() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['animals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export function useAnimal(id: string) {
  return useQuery({
    queryKey: ['animal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateAnimal() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (animal: {
      name: string
      species: string
      breed?: string
      date_of_birth?: string
      gender?: string
      weight_kg?: number
      microchip_number?: string
      tattoo_number?: string
      avatar_url?: string
    }) => {
      const { data, error } = await supabase
        .from('animals')
        .insert({ ...animal, owner_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  })
}

export function useUpdateAnimal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('animals')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  })
}

export function useDeleteAnimal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('animals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals'] }),
  })
}

export function useVaccines(animalId: string) {
  return useQuery({
    queryKey: ['vaccines', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vaccines')
        .select('*')
        .eq('animal_id', animalId)
        .order('date_administered', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!animalId,
  })
}

export function useCreateVaccine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vaccine: {
      animal_id: string
      name: string
      date_administered: string
      next_due_date?: string
      administered_by?: string
      notes?: string
    }) => {
      const { error } = await supabase.from('vaccines').insert(vaccine)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['vaccines', vars.animal_id] }),
  })
}

export function useUpdateVaccine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, animal_id, ...updates }: {
      id: string
      animal_id: string
      name?: string
      date_administered?: string
      next_due_date?: string
      administered_by?: string
      notes?: string
    }) => {
      const { error } = await supabase.from('vaccines').update(updates).eq('id', id)
      if (error) throw error
      return animal_id
    },
    onSuccess: (animalId) => qc.invalidateQueries({ queryKey: ['vaccines', animalId] }),
  })
}

export function useDeleteVaccine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; animal_id: string }) => {
      const { error } = await supabase.from('vaccines').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['vaccines', vars.animal_id] }),
  })
}

export function useWeightTracking(animalId: string) {
  return useQuery({
    queryKey: ['weight', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_tracking')
        .select('*')
        .eq('animal_id', animalId)
        .order('measured_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!animalId,
  })
}

export function useCreateWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: {
      animal_id: string
      weight_kg: number
      measured_at: string
      notes?: string
    }) => {
      const { error } = await supabase.from('weight_tracking').insert(entry)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['weight', vars.animal_id] }),
  })
}

export function useUpdateWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, animal_id, ...updates }: {
      id: string
      animal_id: string
      weight_kg?: number
      measured_at?: string
      notes?: string
    }) => {
      const { error } = await supabase.from('weight_tracking').update(updates).eq('id', id)
      if (error) throw error
      return animal_id
    },
    onSuccess: (animalId) => qc.invalidateQueries({ queryKey: ['weight', animalId] }),
  })
}

export function useDeleteWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; animal_id: string }) => {
      const { error } = await supabase.from('weight_tracking').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['weight', vars.animal_id] }),
  })
}

export function useHealthRecords(animalId: string) {
  return useQuery({
    queryKey: ['health_records', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('animal_id', animalId)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!animalId,
  })
}

// ── CLINICS ──────────────────────────────────────────────────────────────────

export function useMyClinic(doctorId?: string) {
  return useQuery({
    queryKey: ['clinic', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_members')
        .select('clinic_id, clinics(id, name, address, city, phone, invite_code, owner_id)')
        .eq('doctor_id', doctorId!)
        .single()
      if (error) return null
      return (data?.clinics ?? null) as any
    },
    enabled: !!doctorId,
  })
}

// Fiche praticien publique (accessible sans connexion) : passe par une RPC
// SECURITY DEFINER car un embed direct clinic_members->clinics serait
// bloqué par le RLS pour un visiteur qui n'est ni owner ni membre.
export function useDoctorPublicClinic(doctorId?: string) {
  return useQuery({
    queryKey: ['doctor-public-clinic', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_doctor_clinic', { p_doctor_id: doctorId })
      if (error) throw error
      return (data?.[0] ?? null) as { clinic_id: string; clinic_name: string; address: string | null; city: string | null; phone: string | null } | null
    },
    enabled: !!doctorId,
  })
}

// Retirer un membre du cabinet — réservé au créateur (vérifié côté RPC,
// SECURITY DEFINER, car on ne connaît pas le détail du RLS de clinic_members
// pour ce genre d'opération croisée entre utilisateurs).
export function useRemoveClinicMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clinicMemberId }: { clinicMemberId: string; clinicId: string }) => {
      const { error } = await supabase.rpc('remove_clinic_member', { p_clinic_member_id: clinicMemberId })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic_members', vars.clinicId] }),
  })
}

export function useClinicMembers(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic_members', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_members')
        .select(`
          id, doctor_id, joined_at,
          doctors(id, specialty, user_id,
            profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url)
          )
        `)
        .eq('clinic_id', clinicId!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

export function useClinicAppointments(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic_appointments', clinicId],
    queryFn: async () => {
      // Récupère tous les doctor_ids du cabinet
      const { data: members } = await supabase
        .from('clinic_members')
        .select('doctor_id')
        .eq('clinic_id', clinicId!)
      if (!members || members.length === 0) return []
      const doctorIds = members.map(m => m.doctor_id)
      const { data, error } = await supabase
        .from('appointments')
        .select(`*, doctors!inner(specialty, user_id, profiles!doctors_user_id_profiles_fkey(first_name, last_name))`)
        .in('doctor_id', doctorIds)
        .order('start_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

export function useCreateClinic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, address, city, doctorId }: { name: string; address?: string; city?: string; doctorId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const inviteCode = Math.random().toString(36).substring(2, 6).toUpperCase() +
                         Math.random().toString(36).substring(2, 6).toUpperCase()

      const { data: clinic, error } = await supabase
        .from('clinics')
        .insert({ name, address, city, owner_id: user.id, invite_code: inviteCode })
        .select()
        .single()
      if (error) throw new Error(error.message)

      const { error: memberError } = await supabase
        .from('clinic_members')
        .insert({ clinic_id: clinic.id, doctor_id: doctorId })
      if (memberError) throw new Error(memberError.message)

      return clinic
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic', vars.doctorId] }),
  })
}

export function useJoinClinic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ inviteCode, doctorId }: { inviteCode: string; doctorId: string }) => {
      // Passe par une RPC SECURITY DEFINER : une requête directe sur `clinics`
      // est bloquée par le RLS tant qu'on n'est pas déjà membre du cabinet
      // (donc la recherche par code échouait toujours pour un nouveau membre).
      const { error } = await supabase.rpc('join_clinic_by_code', {
        p_invite_code: inviteCode.toUpperCase(),
        p_doctor_id: doctorId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic', vars.doctorId] }),
  })
}

export function useClinicServices(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic_services', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_services')
        .select('*')
        .eq('clinic_id', clinicId!)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

export function useAddClinicService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clinicId, name, price, duration }: { clinicId: string; name: string; price: number | null; duration: string }) => {
      const { error } = await supabase
        .from('clinic_services')
        .insert({ clinic_id: clinicId, name, price, duration })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic_services', vars.clinicId] }),
  })
}

export function useDeleteClinicService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, clinicId }: { id: string; clinicId: string }) => {
      const { error } = await supabase.from('clinic_services').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic_services', vars.clinicId] }),
  })
}

export function useUpdateClinic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, address, city, phone }: { id: string; name: string; address?: string; city?: string; phone?: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({ name, address, city, phone })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clinic'] }),
  })
}

export function useCreateHealthRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (record: {
      animal_id: string
      date: string
      type: string
      title: string
      description?: string
      professional_name?: string
    }) => {
      const { error } = await supabase.from('health_records').insert(record)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['health_records', vars.animal_id] }),
  })
}

export function useUpdateHealthRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, animal_id, ...updates }: {
      id: string
      animal_id: string
      date?: string
      type?: string
      title?: string
      description?: string
      professional_name?: string
    }) => {
      const { error } = await supabase.from('health_records').update(updates).eq('id', id)
      if (error) throw error
      return animal_id
    },
    onSuccess: (animalId) => qc.invalidateQueries({ queryKey: ['health_records', animalId] }),
  })
}

export function useDeleteHealthRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; animal_id: string }) => {
      const { error } = await supabase.from('health_records').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['health_records', vars.animal_id] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { profile, setProfile } = useAuthStore()
  return useMutation({
    mutationFn: async (updates: {
      first_name?: string
      last_name?: string
      phone?: string
      address?: string
      emergency_contact_name?: string
      emergency_contact_phone?: string
    }) => {
      if (!profile) throw new Error('Profil non chargé')
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', profile.user_id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setProfile(data)
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useUpdateDoctor() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (updates: {
      specialty?: string
      bio?: string
      city?: string
      address?: string
      consultation_price?: number
    }) => {
      if (!user) throw new Error('Utilisateur non connecté')
      const { error } = await supabase
        .from('doctors')
        .update(updates)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentDoctor'] })
      qc.invalidateQueries({ queryKey: ['doctors'] })
    },
  })
}

// Suppression définitive du compte (RDV, animaux/dossiers de santé,
// cabinet possédé, messages, avis, etc.) via une RPC SECURITY DEFINER —
// nécessaire car le client ne peut pas supprimer une ligne auth.users, et
// certaines tables (appointments) ont une contrainte "on delete restrict"
// qui bloquerait sinon toute suppression dès qu'un RDV existe.
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw new Error(error.message)
    },
  })
}
