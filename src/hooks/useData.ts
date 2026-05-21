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
        .select('*, profiles!user_id(first_name, last_name, avatar_url)')
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
        .select('*, profiles!user_id(first_name, last_name, avatar_url, phone)')
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

export function usePatientAppointments() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['appointments', 'patient', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors!inner(specialty, city, profiles!user_id(first_name, last_name, avatar_url))')
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
      console.log('Fetching appointments for doctorId:', doctorId)
      const { data, error } = await supabase
        .from('appointments')
        .select('*, profiles!patient_id(first_name, last_name, avatar_url, phone)')
        .eq('doctor_id', doctorId!)
        .order('start_at', { ascending: true })
      console.log('appointments data:', data, 'error:', JSON.stringify(error))
      if (error) throw error
      return data
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
        .select('*, profiles!patient_id(first_name, last_name, avatar_url)')
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
      batch_number?: string
      veterinarian?: string
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
        .order('date', { ascending: true })
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
      date: string
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
