// src/hooks/useData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import type { SearchFilters, Appointment, AppointmentStatus } from '@/types'
import { addMinutes, format } from 'date-fns'

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
      const dateStr = format(date, 'yyyy-MM-dd')
      const { data: avail } = await supabase
        .from('availabilities')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
      if (!avail || avail.length === 0) return []
      const { data: booked } = await supabase
        .from('appointments')
        .select('start_at')
        .eq('doctor_id', doctorId)
        .gte('start_at', `${dateStr}T00:00:00`)
        .lte('start_at', `${dateStr}T23:59:59`)
        .in('status', ['pending', 'confirmed'])
      const bookedTimes = new Set((booked || []).map(a => a.start_at))
      const slots: Date[] = []
      for (const a of avail) {
        const [sh, sm] = a.start_time.split(':').map(Number)
        const [eh, em] = a.end_time.split(':').map(Number)
        let cur = new Date(date)
        cur.setHours(sh, sm, 0, 0)
        const end = new Date(date)
        end.setHours(eh, em, 0, 0)
        while (cur < end) {
          if (!bookedTimes.has(cur.toISOString())) slots.push(new Date(cur))
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

export function usePatientAppointments() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['appointments', 'patient', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors!inner(specialty, city, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url))')
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
        .select('*, users!patient_id(id, email, profiles(first_name, last_name, avatar_url, phone)), animals(id, name, species, avatar_url)')
        .eq('doctor_id', doctorId!)
        .order('start_at', { ascending: true })
      if (error) throw error
      // Aligne la forme des données sur le type Appointment (profiles au niveau racine)
      return (data ?? []).map((a: any) => ({ ...a, profiles: a.users?.profiles }))
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
      animal_id?: string
    }) => {
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({ ...data, patient_id: user!.id, status: 'pending' })
        .select()
        .single()
      if (error) throw error
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
        .select('patient_id, users!patient_id(profiles(first_name, last_name))')
        .eq('doctor_id', doctorId!)
        .in('status', ['confirmed', 'completed'])
      if (apptErr) throw apptErr

      const ownerNames = new Map<string, string>()
      ;(appts ?? []).forEach((a: any) => {
        const p = a.users?.profiles
        if (p) ownerNames.set(a.patient_id, `${p.first_name} ${p.last_name}`.trim())
      })
      const patientIds = [...ownerNames.keys()]
      if (patientIds.length === 0) return []

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
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['messages', user?.id, vars.receiverId] }),
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
        .select('clinic_id, clinics(id, name, address, city, invite_code, owner_id)')
        .eq('doctor_id', doctorId!)
        .single()
      if (error) return null
      return (data?.clinics ?? null) as any
    },
    enabled: !!doctorId,
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
      const { data: clinic, error } = await supabase
        .from('clinics')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()
      if (error || !clinic) throw new Error('Code invalide ou cabinet introuvable')
      const { error: memberError } = await supabase
        .from('clinic_members')
        .insert({ clinic_id: clinic.id, doctor_id: doctorId })
      if (memberError) throw new Error('Vous êtes déjà membre de ce cabinet')
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
    mutationFn: async ({ id, name, address, city }: { id: string; name: string; address?: string; city?: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({ name, address, city })
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

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { profile, setProfile } = useAuthStore()
  return useMutation({
    mutationFn: async (updates: { first_name?: string; last_name?: string; phone?: string }) => {
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
