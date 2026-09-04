// src/hooks/useData.ts
import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import type { SearchFilters, Appointment, AppointmentStatus } from '@/types'
import { addMinutes } from 'date-fns'
import { geocodeAddress } from '@/lib/geo'
import { generateAvailableSlots } from '@/lib/slots'
import { findNextAvailableSlot } from '@/lib/nextSlot'
import { urlBase64ToUint8Array } from '@/lib/pushNotifications'

export function useDoctors(filters: SearchFilters = {}, enabled: boolean = true) {
  return useQuery({
    queryKey: ['doctors', filters],
    queryFn: async () => {
      // Un praticien membre d'un cabinet ne doit pas apparaître comme
      // résultat individuel — on ne doit le trouver qu'en passant par la
      // fiche du cabinet (voir get_clinic_member_doctor_ids, migration 044).
      const { data: clinicMembers } = await supabase.rpc('get_clinic_member_doctor_ids')
      const excludedIds = new Set((clinicMembers ?? []).map((m: any) => m.doctor_id))

      let q = supabase
        .from('doctors')
        .select('*, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url)')
        // Un praticien dont le dossier de vérification n'est pas validé
        // (documents en attente ou rejetés) reste invisible du public,
        // même s'il peut déjà utiliser son tableau de bord — voir
        // DoctorPage.tsx pour la même règle appliquée à la fiche directe.
        .eq('verification_status', 'verified')
      if (filters.city)      q = q.ilike('city', `%${filters.city}%`)
      if (filters.maxPrice !== undefined) q = q.lte('consultation_price', filters.maxPrice)
      if (filters.minRating) q = q.gte('average_rating', filters.minRating)
      if (filters.species && filters.species.length > 0) q = q.overlaps('accepted_species', filters.species)
      if (filters.homeVisit) q = q.eq('home_visit', true)
      const { data, error } = await q.order('average_rating', { ascending: false })
      if (error) throw error

      // Filtre spécialité/nom appliqué côté client : un praticien trouvé
      // par SON NOM reste visible même en cabinet, seule la recherche par
      // spécialité masque les membres de cabinet (voir plus haut).
      const term = filters.specialty?.trim().toLowerCase()
      const filtered = !term
        ? (data ?? []).filter((d: any) => !excludedIds.has(d.id))
        : (data ?? []).filter((d: any) => {
            const fullName = `${d.profiles?.first_name ?? ''} ${d.profiles?.last_name ?? ''}`.toLowerCase()
            if (fullName.includes(term)) return true
            return (d.specialty ?? '').toLowerCase().includes(term) && !excludedIds.has(d.id)
          })

      if (!filters.availability) return filtered

      // "Disponible aujourd'hui" / "Disponible dans la semaine" : garde
      // uniquement les praticiens ayant au moins un créneau réellement
      // réservable (hors RDV pris/congés) sur la période choisie — même
      // logique que useAvailableSlots, étendue sur une plage de jours
      // plutôt qu'une seule journée.
      const from = new Date()
      const to = new Date(from)
      if (filters.availability === 'today') to.setHours(23, 59, 59, 999)
      else to.setDate(to.getDate() + 7)
      const results = await Promise.all(
        filtered.map(async (d: any) => ({ d, ok: await hasAvailabilityInRange(d.id, from, to) }))
      )
      return results.filter(r => r.ok).map(r => r.d)
    },
    enabled,
  })
}

// Existe-t-il au moins un créneau réservable pour ce praticien entre `from`
// et `to` ? Réutilise le même principe que useAvailableSlots (disponibilités
// récurrentes moins RDV pris moins congés moins battement de 15 min), mais
// s'arrête au premier créneau libre trouvé plutôt que de tous les lister.
async function hasAvailabilityInRange(doctorId: string, from: Date, to: Date): Promise<boolean> {
  const { data: avail } = await supabase
    .from('availabilities')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('is_active', true)
  if (!avail || avail.length === 0) return false

  const { data: booked, error: bookedErr } = await supabase.rpc('get_booked_slots', {
    p_doctor_id: doctorId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
  // En échec, on ne sait plus ce qui est réellement pris : mieux vaut
  // sous-déclarer la disponibilité (fail closed) que risquer d'afficher
  // "disponible" pour un créneau en réalité déjà occupé ou en congé.
  if (bookedErr) return false
  const bookedTimes = new Set((booked || []).map((a: any) => new Date(a.start_at).getTime()))

  const { data: blocked, error: blockedErr } = await supabase
    .from('blocked_slots')
    .select('start_at, end_at')
    .eq('doctor_id', doctorId)
    .lt('start_at', to.toISOString())
    .gt('end_at', from.toISOString())
  if (blockedErr) return false
  const blockedRanges = (blocked || []).map((b: any) => ({
    start: new Date(b.start_at).getTime(),
    end: new Date(b.end_at).getTime(),
  }))

  const minStart = Date.now() + 15 * 60 * 1000

  for (let day = new Date(from); day < to; day.setDate(day.getDate() + 1)) {
    const dayOfWeek = day.getDay()
    for (const a of avail) {
      if (a.day_of_week !== dayOfWeek) continue
      const [sh, sm] = a.start_time.split(':').map(Number)
      const [eh, em] = a.end_time.split(':').map(Number)
      let cur = new Date(day); cur.setHours(sh, sm, 0, 0)
      const end = new Date(day); end.setHours(eh, em, 0, 0)
      while (cur < end) {
        const t = cur.getTime()
        const isBlocked = blockedRanges.some(r => t >= r.start && t < r.end)
        if (t >= minStart && !bookedTimes.has(t) && !isBlocked) return true
        cur = addMinutes(cur, a.slot_duration_minutes)
      }
    }
  }
  return false
}

// Prochain créneau réservable de chaque praticien d'une liste — utilisé
// pour le tri "Prochaine disponibilité" et le badge affiché sur chaque
// DoctorCard en résultat de recherche. Même source de données que
// hasAvailabilityInRange (disponibilités + RDV pris + congés), mais
// renvoie la date exacte du premier créneau plutôt qu'un simple booléen,
// sur une fenêtre de 30 jours.
export function useNextAvailableSlots(doctorIds: string[]) {
  const sortedIds = [...doctorIds].sort()
  return useQuery({
    queryKey: ['next-available-slots', sortedIds],
    queryFn: async () => {
      const now = new Date()
      const to = new Date(now)
      to.setDate(to.getDate() + 30)

      const entries = await Promise.all(sortedIds.map(async (doctorId): Promise<[string, string | null]> => {
        const { data: avail } = await supabase
          .from('availabilities')
          .select('day_of_week, start_time, end_time, slot_duration_minutes')
          .eq('doctor_id', doctorId)
          .eq('is_active', true)
        if (!avail || avail.length === 0) return [doctorId, null]

        const { data: booked, error: bookedErr } = await supabase.rpc('get_booked_slots', {
          p_doctor_id: doctorId,
          p_from: now.toISOString(),
          p_to: to.toISOString(),
        })
        // Fail closed : sur erreur, on ne peut plus garantir qu'un créneau
        // proposé est réellement libre, donc on n'en propose aucun pour ce
        // praticien plutôt que d'ignorer silencieusement ses RDV/congés.
        if (bookedErr) return [doctorId, null]
        const bookedTimes = new Set<number>((booked || []).map((a: any) => new Date(a.start_at).getTime()))

        const { data: blocked, error: blockedErr } = await supabase
          .from('blocked_slots')
          .select('start_at, end_at')
          .eq('doctor_id', doctorId)
          .lt('start_at', to.toISOString())
          .gt('end_at', now.toISOString())
        if (blockedErr) return [doctorId, null]
        const blockedRanges = (blocked || []).map((b: any) => ({
          start: new Date(b.start_at).getTime(),
          end: new Date(b.end_at).getTime(),
        }))

        const next = findNextAvailableSlot(avail, bookedTimes, blockedRanges, now.getTime(), now, 30)
        return [doctorId, next ? next.toISOString() : null]
      }))

      return Object.fromEntries(entries) as Record<string, string | null>
    },
    enabled: sortedIds.length > 0,
  })
}

// Recherche de cabinets (équipe de plusieurs praticiens), groupés comme
// leur propre "profil" dans les résultats de recherche — voir RPC
// search_clinics (migration 034), nécessaire car la RLS sur `clinics` ne
// laisse pas un visiteur lire les cabinets dont il n'est pas membre.
export function useClinicsSearch(filters: SearchFilters = {}, enabled: boolean = true) {
  return useQuery({
    queryKey: ['clinics-search', filters.city, filters.specialty],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_clinics', {
        p_city: filters.city || null,
        p_specialty: filters.specialty || null,
      })
      if (error) throw error
      return data ?? []
    },
    enabled,
  })
}

// Fiche publique d'un cabinet, pour la page /cabinet/:id
export function useClinicInfo(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic-info', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clinic_info', { p_clinic_id: clinicId })
      if (error) throw error
      return data?.[0] ?? null
    },
    enabled: !!clinicId,
  })
}

// Équipe complète d'un cabinet (tous les praticiens membres)
export function useClinicTeam(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic-team', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clinic_team', { p_clinic_id: clinicId })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

// Disponibilités hebdomadaires (récurrentes) de plusieurs praticiens à la
// fois — `availabilities` est en lecture publique, pas besoin de RPC.
export function useDoctorsAvailabilities(doctorIds: string[]) {
  return useQuery({
    queryKey: ['availabilities-batch', ...doctorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availabilities')
        .select('*')
        .in('doctor_id', doctorIds)
        .eq('is_active', true)
        .order('day_of_week')
      if (error) throw error
      return data ?? []
    },
    enabled: doctorIds.length > 0,
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
      const bookedTimes = new Set<number>((booked || []).map((a: any) => new Date(a.start_at).getTime()))

      // Périodes de congés/indisponibilités posées par le praticien
      // (blocked_slots) : on exclut tout créneau qui tombe dedans.
      const { data: blocked, error: blockedErr } = await supabase
        .from('blocked_slots')
        .select('start_at, end_at')
        .eq('doctor_id', doctorId)
        .lt('start_at', dayEnd.toISOString())
        .gt('end_at', dayStart.toISOString())
      if (blockedErr) throw blockedErr
      const blockedRanges: { start: number; end: number }[] = (blocked || []).map((b: any) => ({
        start: new Date(b.start_at).getTime(),
        end: new Date(b.end_at).getTime(),
      }))

      // Délai de battement minimum avant un RDV : un créneau qui commence
      // dans moins de 15 min n'est plus réservable (le reste de la
      // journée reste visible normalement).
      const minStart = Date.now() + 15 * 60 * 1000

      return generateAvailableSlots(date, avail, bookedTimes, blockedRanges, minStart)
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
      // Colonnes explicites plutôt que "*" : `notes` (notes internes du
      // médecin, voir 001_schema.sql) ne doit jamais transiter jusqu'au
      // navigateur du patient, même si rien ne l'affiche à l'écran —
      // "*" l'incluait quand même dans la réponse réseau.
      const { data, error } = await supabase
        .from('appointments')
        .select('id, patient_id, doctor_id, start_at, end_at, status, reason, confirmed_by_patient_at, doctors!inner(id, specialty, city, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url)), reviews(id, rating, comment)')
        .eq('patient_id', user!.id)
        .order('start_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// Tuile "Rappels" du dashboard patient : regroupe les rendez-vous déjà
// planifiés (à venir) et les rappels de vaccin (date de rappel renseignée)
// de tous ses animaux, tous confondus. Il n'existe pas encore de champ
// dédié "check-up" dans le schéma — un contrôle général se traduit soit par
// un RDV déjà pris (première section), soit par un rappel de vaccin
// (deuxième section) : pas besoin d'une troisième source de données tant
// qu'un vrai suivi de check-up n'est pas défini.
export function usePatientReminders() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['patient-reminders', user?.id],
    queryFn: async () => {
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('id, start_at, reason, doctors!inner(specialty, profiles!doctors_user_id_profiles_fkey(first_name, last_name))')
        .eq('patient_id', user!.id)
        .eq('status', 'confirmed')
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
      if (apptErr) throw apptErr

      const { data: animals, error: animalErr } = await supabase
        .from('animals')
        .select('id, name, species')
        .eq('owner_id', user!.id)
      if (animalErr) throw animalErr
      const animalIds = (animals ?? []).map((a: any) => a.id)
      const animalById = new Map((animals ?? []).map((a: any) => [a.id, a]))

      let vaccineReminders: any[] = []
      if (animalIds.length > 0) {
        const { data: vaccines, error: vaccErr } = await supabase
          .from('vaccines')
          .select('id, name, next_due_date, animal_id')
          .in('animal_id', animalIds)
          .not('next_due_date', 'is', null)
          .order('next_due_date', { ascending: true })
        if (vaccErr) throw vaccErr
        vaccineReminders = (vaccines ?? []).map((v: any) => ({ ...v, animal: animalById.get(v.animal_id) }))
      }

      return { appointments: appts ?? [], vaccineReminders }
    },
    enabled: !!user,
  })
}

export function useDoctorAppointments(doctorId?: string) {
  return useQuery({
    queryKey: ['appointments', 'doctor', doctorId],
    queryFn: async () => {
      // `users!patient_id(...)` est bloqué par le RLS : un praticien n'a pas
      // le droit de lire la ligne `users` d'un autre utilisateur, donc cet
      // embed renvoyait null silencieusement (nom du patient jamais affiché
      // sur "Liste RDV"). Même bug que useDoctorPatientAnimals/
      // useClinicAppointments : deux requêtes séparées (RDV, puis profils
      // des patients via `profiles`, autorisé) fusionnées côté client.
      // Colonnes explicites plutôt que "*" : `notes` (notes internes du
      // médecin) n'est lu nulle part dans l'UI — aucune raison de le
      // renvoyer, et la colonne est de toute façon verrouillée en lecture
      // côté base (migration 080) pour le rôle authenticated.
      const { data, error } = await supabase
        .from('appointments')
        .select('id, patient_id, doctor_id, start_at, end_at, status, reason, confirmed_by_patient_at, appointment_animals(animals(id, name, species, avatar_url))')
        .eq('doctor_id', doctorId!)
        .order('start_at', { ascending: true })
      if (error) throw error

      const patientIds = [...new Set((data ?? []).map((a: any) => a.patient_id))]
      const profilesByPatient = new Map<string, any>()
      if (patientIds.length > 0) {
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url, phone')
          .in('user_id', patientIds)
        if (profErr) throw profErr
        ;(profilesData ?? []).forEach((p: any) => profilesByPatient.set(p.user_id, p))
      }

      // Aligne la forme des données sur le type Appointment : profiles au
      // niveau racine, et animaux à plat (un RDV peut concerner plusieurs animaux).
      return (data ?? []).map((a: any) => ({
        ...a,
        profiles: profilesByPatient.get(a.patient_id) ?? null,
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
      documents?: { file_name: string; file_url: string; file_type: string }[]
    }) => {
      const { animal_ids, documents, ...apptData } = data
      // .select('id') plutôt que .select() ("*" implicite) : seul appt.id
      // sert plus bas, et "*" inclurait notes (verrouillée en lecture,
      // migration 080) alors qu'elle est toujours vide à la création.
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({ ...apptData, patient_id: user!.id, status: 'confirmed' })
        .select('id')
        .single()
      if (error) throw error

      // Lie le(s) animal(aux) choisi(s) au RDV (table de liaison many-to-many).
      // Sur échec ici ou pour les documents ci-dessous, on annule le RDV déjà
      // inséré plutôt que de le laisser orphelin : sans ça, il restait
      // "confirmed" sans animal rattaché, occupait quand même le créneau
      // (index unique partiel, migration 070), et un nouvel essai de
      // réservation entrait en collision avec ce propre RDV cassé — impossible
      // à corriger par un simple nouvel essai.
      if (animal_ids && animal_ids.length > 0) {
        const { error: linkError } = await supabase
          .from('appointment_animals')
          .insert(animal_ids.map(animal_id => ({ appointment_id: appt.id, animal_id })))
        if (linkError) {
          await supabase.from('appointments').delete().eq('id', appt.id)
          throw linkError
        }
      }

      // Pièces jointes (documents/photos) : déjà uploadées vers le storage au
      // moment de la sélection (étape 2), il ne reste qu'à créer les lignes
      // qui les lient à ce RDV.
      if (documents && documents.length > 0) {
        const { error: docError } = await supabase.from('appointment_documents').insert(
          documents.map(d => ({
            appointment_id: appt.id,
            uploaded_by: user!.id,
            file_url: d.file_url,
            file_name: d.file_name,
            file_type: d.file_type,
          }))
        )
        if (docError) {
          await supabase.from('appointment_animals').delete().eq('appointment_id', appt.id)
          await supabase.from('appointments').delete().eq('id', appt.id)
          throw docError
        }
      }

      // Email de confirmation + notification in-app (Edge Function
      // send-appointment-confirmation, service Resend). En "best effort" :
      // le RDV reste confirmé même si l'envoi échoue (clé Resend absente,
      // domaine pas encore vérifié...), on ne bloque jamais la réservation.
      try {
        await supabase.functions.invoke('send-appointment-confirmation', {
          body: { appointmentId: appt.id },
        })
      } catch (emailError) {
        console.error('Confirmation email non envoyée :', emailError)
      }

      return appt
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      qc.invalidateQueries({ queryKey: ['clinic_appointments'] })
    },
  })
}

// Liste d'attente (migration 065) : un patient s'inscrit pour un praticien
// donné et reçoit une notification in-app dès qu'un RDV chez ce praticien
// est annulé (trigger notify_waitlist_on_cancellation, alerte à usage
// unique — l'entrée est marquée notified_at et ne redéclenche plus rien).
export function useMyWaitlistEntry(doctorId?: string) {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['waitlist_entry', doctorId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('id')
        .eq('doctor_id', doctorId!)
        .eq('patient_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user && !!doctorId,
  })
}

export function useJoinWaitlist() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (doctorId: string) => {
      const { error } = await supabase.from('waitlist_entries').insert({
        doctor_id: doctorId, patient_id: user!.id,
      })
      if (error) throw error
    },
    onSuccess: (_, doctorId) => qc.invalidateQueries({ queryKey: ['waitlist_entry', doctorId] }),
  })
}

export function useLeaveWaitlist() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (doctorId: string) => {
      const { error } = await supabase.from('waitlist_entries')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('patient_id', user!.id)
      if (error) throw error
    },
    onSuccess: (_, doctorId) => qc.invalidateQueries({ queryKey: ['waitlist_entry', doctorId] }),
  })
}

// Pièces jointes liées à un RDV (documents envoyés par le patient à la réservation)
export function useAppointmentDocuments(appointmentId?: string) {
  return useQuery({
    queryKey: ['appointment_documents', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_documents')
        .select('*')
        .eq('appointment_id', appointmentId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!appointmentId,
  })
}

// Tous les animaux des patients d'un praticien (RDV confirmé ou terminé).
// Si `clinicId` est fourni, inclut aussi les patients vus par n'importe quel
// collègue du même cabinet (pour pouvoir couvrir un collègue absent/en
// congé) — chaque animal est alors annoté du praticien référent (doctor_id
// du RDV le plus récent), pour affichage d'un badge dans "Mes patients".
// `clinicReady` doit passer à false tant que la recherche du cabinet
// (useMyClinic) n'est pas terminée : sans ça, cette requête se déclenche
// une première fois avec clinicId=undefined (patients perso uniquement),
// puis une seconde fois dès que le cabinet est trouvé — ce qui fait
// clignoter "Mes patients" (vide puis rempli) à chaque chargement/
// changement de page.
export function useDoctorPatientAnimals(doctorId?: string, clinicId?: string, clinicReady: boolean = true) {
  return useQuery({
    queryKey: ['doctor-patient-animals', doctorId, clinicId],
    queryFn: async () => {
      let doctorIds = [doctorId!]
      if (clinicId) {
        const { data: members, error: membersErr } = await supabase
          .from('clinic_members')
          .select('doctor_id')
          .eq('clinic_id', clinicId)
        if (membersErr) throw membersErr
        doctorIds = (members ?? []).map((m: any) => m.doctor_id)
        if (doctorIds.length === 0) doctorIds = [doctorId!]
      }

      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('patient_id, doctor_id, start_at, status')
        .in('doctor_id', doctorIds)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true })
      if (apptErr) throw apptErr

      // Praticien référent = doctor_id du RDV confirmé/terminé le plus
      // récent pour ce patient (dernier itéré, grâce au tri croissant).
      const referentByPatient = new Map<string, string>()
      ;(appts ?? []).forEach((a: any) => referentByPatient.set(a.patient_id, a.doctor_id))

      // Fidélité : nombre de RDV et date du dernier, tous confrères du
      // cabinet confondus (même périmètre que le praticien référent
      // ci-dessus) — affiché sur "Mes patients" pour repérer les habitués.
      // Ne compte que des visites réellement passées et honorées : un RDV
      // à venir (encore juste réservé) ou un no_show gonflait le compteur
      // et pouvait même s'afficher comme "dernier RDV" alors qu'il n'a
      // jamais eu lieu.
      const now = Date.now()
      const loyaltyByPatient = new Map<string, { count: number; lastAt: string }>()
      ;(appts ?? []).forEach((a: any) => {
        if (a.status === 'no_show' || new Date(a.start_at).getTime() > now) return
        const prev = loyaltyByPatient.get(a.patient_id)
        loyaltyByPatient.set(a.patient_id, {
          count: (prev?.count ?? 0) + 1,
          lastAt: a.start_at, // tri croissant : la dernière itération est la plus récente
        })
      })

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

      return (animals ?? []).map((an: any) => ({
        ...an,
        ownerName: ownerNames.get(an.owner_id) ?? '',
        referentDoctorId: referentByPatient.get(an.owner_id) ?? null,
        ownerAppointmentCount: loyaltyByPatient.get(an.owner_id)?.count ?? 0,
        ownerLastAppointmentAt: loyaltyByPatient.get(an.owner_id)?.lastAt ?? null,
      }))
    },
    enabled: !!doctorId && clinicReady,
  })
}

// ── AGENDA PARTAGÉ DU CABINET (disponibilités + congés de tous les membres) ──

export function useClinicAvailabilities(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic-availabilities', clinicId],
    queryFn: async () => {
      const { data: members, error: membersErr } = await supabase
        .from('clinic_members')
        .select('doctor_id')
        .eq('clinic_id', clinicId!)
      if (membersErr) throw membersErr
      const doctorIds = (members ?? []).map((m: any) => m.doctor_id)
      if (doctorIds.length === 0) return []
      const { data, error } = await supabase
        .from('availabilities')
        .select('*')
        .in('doctor_id', doctorIds)
        .eq('is_active', true)
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

export function useClinicBlockedSlotsAll(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic-blocked-slots-all', clinicId],
    queryFn: async () => {
      const { data: members, error: membersErr } = await supabase
        .from('clinic_members')
        .select('doctor_id')
        .eq('clinic_id', clinicId!)
      if (membersErr) throw membersErr
      const doctorIds = (members ?? []).map((m: any) => m.doctor_id)
      if (doctorIds.length === 0) return []
      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .in('doctor_id', doctorIds)
        .order('start_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
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
        .update({
          status, notes, updated_at: new Date().toISOString(),
          // Point de départ de la fenêtre du rappel "laisser un avis"
          // (voir send-reminders) : ne se déclenche que sur ce passage à
          // completed, jamais réécrit ensuite par une autre transition.
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    // ['slots']/['clinic_appointments'] manquaient : un patient annulé/
    // no-show ne libérait pas le créneau immédiatement dans le cache — il
    // restait affiché comme indisponible jusqu'à expiration naturelle.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      qc.invalidateQueries({ queryKey: ['clinic_appointments'] })
    },
  })
}

// Report d'un RDV confirmé par le praticien (nouveau créneau plutôt
// qu'une annulation) — la notification patient (in-app + email + SMS) est
// gérée côté base par un trigger sur ce changement de start_at, pas ici
// (même mécanisme que l'annulation, voir migrations 076/077).
export function useRescheduleAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, start_at, end_at }: { id: string; start_at: string; end_at: string }) => {
      const { error } = await supabase
        .from('appointments')
        // Le patient n'a confirmé sa présence que pour l'ancien créneau —
        // sans cette remise à zéro, le badge "Présence confirmée" resterait
        // affiché à tort après un report vers une toute autre date.
        .update({ start_at, end_at, confirmed_by_patient_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      qc.invalidateQueries({ queryKey: ['clinic_appointments'] })
    },
  })
}

// Praticiens favoris du patient — accès rapide depuis l'accueil,
// indépendant de tout historique de RDV (contrairement à
// usePatientAppointments, utilisé pour "derniers praticiens consultés").
export function useFavorites() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('id, doctor_id, created_at, doctors!inner(id, specialty, profiles!doctors_user_id_profiles_fkey(first_name, last_name, avatar_url))')
        .eq('patient_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export function useIsFavorite(doctorId: string) {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['favorite', user?.id, doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('patient_id', user!.id)
        .eq('doctor_id', doctorId)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
    enabled: !!user && !!doctorId,
  })
}

// Historique du patient avec CE praticien précis (fiche praticien) —
// symétrique à l'indicateur de fidélité affiché côté praticien sur
// "Mes patients" (voir useDoctorPatientAnimals).
export function useMyHistoryWithDoctor(doctorId?: string) {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['my-history-with-doctor', user?.id, doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('start_at')
        .eq('patient_id', user!.id)
        .eq('doctor_id', doctorId!)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: false })
      if (error) throw error
      return { count: data.length, lastAt: data[0]?.start_at ?? null }
    },
    enabled: !!user && user.role === 'patient' && !!doctorId,
  })
}

export function useToggleFavorite() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ doctorId, isFavorite }: { doctorId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        const { error } = await supabase.from('favorites').delete().eq('patient_id', user!.id).eq('doctor_id', doctorId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('favorites').insert({ patient_id: user!.id, doctor_id: doctorId })
        if (error) throw error
      }
    },
    onSuccess: (_, { doctorId }) => {
      qc.invalidateQueries({ queryKey: ['favorite', user?.id, doctorId] })
      qc.invalidateQueries({ queryKey: ['favorites', user?.id] })
    },
  })
}

export function useDoctorReviews(doctorId: string) {
  return useQuery({
    queryKey: ['reviews', doctorId],
    queryFn: async () => {
      // Passe par une RPC SECURITY DEFINER : le prénom/nom du patient
      // (profiles) est privé par RLS, un embed direct renvoie toujours
      // `null` pour l'auteur même si l'avis lui-même est public.
      const { data, error } = await supabase.rpc('get_doctor_reviews', { p_doctor_id: doctorId })
      if (error) throw error
      const rows: any[] = data ?? []
      return rows.map(r => ({
        ...r,
        profiles: { first_name: r.patient_first_name, last_name: r.patient_last_name, avatar_url: r.patient_avatar_url },
      }))
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['reviews'] })
      // ['my-review', doctorId] retiré : aucun useQuery n'utilise cette clé,
      // c'était un no-op silencieux.
    },
  })
}

export function useReplyToReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; doctorId: string; reply: string }) => {
      const { error } = await supabase.rpc('reply_to_review', { p_review_id: reviewId, p_reply: reply })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['reviews', vars.doctorId] }),
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
      qc.invalidateQueries({ queryKey: ['conversation-partners'] })
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

// Note : il n'existe plus de suppression de conversation côté base — elle
// supprimait les messages pour les deux personnes à la fois (une conversation
// est une donnée partagée). "Supprimer une conversation" est désormais un
// masquage 100% personnel (localStorage, voir hiddenIds/hiddenConvIds dans
// MessagesPage.tsx et DoctorDashboard.tsx) : ça ne retire rien à l'autre
// personne, qui garde tout son historique.

// Abonnement temps réel aux nouveaux messages reçus, partagé entre
// MessagesPage.tsx (patient) et DoctorDashboard.tsx (médecin) — logique
// identique dans les deux, seul le préfixe de canal changeait. Filtre côté
// serveur sur receiver_id : sans lui, ce canal se déclenchait sur CHAQUE
// message envoyé par n'importe quel utilisateur de la plateforme, pas
// seulement ceux adressés à cet utilisateur.
export function useMessagingRealtime(
  userId: string | undefined,
  channelPrefix: string,
  onNewMessage: (senderId: string) => void
) {
  const qc = useQueryClient()
  // Ref plutôt que dépendance directe : l'effet ne doit se ré-abonner que
  // si userId change, mais doit toujours appeler la DERNIÈRE version de
  // onNewMessage (ex: unhideContact, qui ferme sur hiddenIds) — sinon un
  // message arrivant après que la liste masquée ait changé retombe sur une
  // version obsolète du callback et le "révéler à l'arrivée d'un message"
  // ne se déclenche jamais.
  const onNewMessageRef = useRef(onNewMessage)
  onNewMessageRef.current = onNewMessage

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`${channelPrefix}-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ['messages'] })
        qc.invalidateQueries({ queryKey: ['conversation-partners'] })
        // Si la personne qui vient d'écrire avait été masquée (suite à une
        // suppression de conversation de notre côté), on la ré-affiche : un
        // nouveau message mérite de réapparaître dans le feed, même sans
        // réponse de notre part.
        const m = payload.new
        if (m) onNewMessageRef.current(m.sender_id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])
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

// ── ANIMAL DOCUMENTS (onglet Documents du dossier animal) ────────────────────

// `uploaded_by` référence auth.users (pas public.profiles), donc pas
// d'embed PostgREST possible — on résout le nom via une seconde requête
// groupée sur `profiles.user_id`, qui existe pour tout le monde (patient
// comme praticien, créé automatiquement à l'inscription).
async function attachUploaderNames<T extends { uploaded_by: string }>(docs: T[]): Promise<(T & { uploaderName: string })[]> {
  const ids = [...new Set(docs.map(d => d.uploaded_by))]
  if (ids.length === 0) return docs as (T & { uploaderName: string })[]
  const { data: profilesData, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', ids)
  if (error) throw error
  const names = new Map<string, string>()
  ;(profilesData ?? []).forEach((p: any) => names.set(p.user_id, `${p.first_name} ${p.last_name}`.trim()))
  return docs.map(d => ({ ...d, uploaderName: names.get(d.uploaded_by) || 'Utilisateur' }))
}

export function useAnimalDocuments(animalId?: string) {
  return useQuery({
    queryKey: ['animal_documents', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animal_documents')
        .select('*')
        .eq('animal_id', animalId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return attachUploaderNames(data ?? [])
    },
    enabled: !!animalId,
  })
}

export type DocumentType = 'ordonnance' | 'analyse' | 'radio' | 'certificat' | 'autre'

export function useCreateAnimalDocument() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async ({ animal_id, file, label, document_type }: {
      animal_id: string; file: File; label?: string; document_type?: DocumentType
    }) => {
      const ext = file.name.split('.').pop()
      const path = `animals/${animal_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
      if (uploadError) throw uploadError
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)
      const { error } = await supabase.from('animal_documents').insert({
        animal_id,
        uploaded_by: user!.id,
        file_url: pub.publicUrl,
        file_name: file.name,
        file_type: file.type,
        label: label || undefined,
        document_type: document_type || 'autre',
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['animal_documents', vars.animal_id] })
      qc.invalidateQueries({ queryKey: ['patient-doctor-documents'] })
    },
  })
}

// Tous les documents (ordonnances, analyses, radios...) déposés par un
// praticien dans le dossier des animaux du patient connecté — pas ceux que
// le patient a lui-même envoyés, qu'il a déjà sous les yeux dans l'onglet
// "Documents" de chaque animal. La RLS "animal_documents: propriétaire voit
// les siens" limite déjà le résultat aux documents des animaux qui lui
// appartiennent ; on filtre ensuite côté client sur uploaded_by ≠
// owner_id (impossible à exprimer proprement en un seul filtre PostgREST
// puisque ce sont deux colonnes de deux tables différentes).
//
// Complété par les pièces jointes envoyées par le patient lui-même au
// moment de la prise de RDV (appointment_documents, étape 2 de BookPage) :
// une ordonnance jointe pour justifier un renouvellement, par exemple, doit
// rester consultable ici même si c'est le patient qui l'a déposée.
export function usePatientDoctorDocuments() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['patient-doctor-documents', user?.id],
    queryFn: async () => {
      const { data: animalDocs, error: animalErr } = await supabase
        .from('animal_documents')
        .select('*, animals(id, name, species, avatar_url, owner_id)')
        .order('created_at', { ascending: false })
      if (animalErr) throw animalErr
      const doctorAnimalDocs = (animalDocs ?? [])
        .filter((d: any) => d.uploaded_by !== d.animals?.owner_id)
        .map((d: any) => ({ ...d, source: 'animal' as const }))

      // RLS "appointment_documents: patient voit les siens" limite déjà le
      // résultat aux pièces jointes de ses propres RDV.
      const { data: apptDocs, error: apptErr } = await supabase
        .from('appointment_documents')
        .select('*, appointments(start_at, doctors(profiles!doctors_user_id_profiles_fkey(first_name, last_name)))')
        .order('created_at', { ascending: false })
      if (apptErr) throw apptErr
      const bookingDocs = (apptDocs ?? []).map((d: any) => ({ ...d, source: 'appointment' as const }))

      const merged = [...doctorAnimalDocs, ...bookingDocs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      return attachUploaderNames(merged)
    },
    enabled: !!user,
  })
}

export function useDeleteAnimalDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; animal_id: string }) => {
      const { error } = await supabase.from('animal_documents').delete().eq('id', id)
      if (error) throw error
    },
    // ['patient-doctor-documents'] manquait (présent sur useCreateAnimalDocument) :
    // le document supprimé restait visible dans la vue agrégée côté médecin.
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['animal_documents', vars.animal_id] })
      qc.invalidateQueries({ queryKey: ['patient-doctor-documents'] })
    },
  })
}

// ── CLINICS ──────────────────────────────────────────────────────────────────

export function useMyClinic(doctorId?: string) {
  return useQuery({
    queryKey: ['clinic', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_members')
        .select('clinic_id, clinics(id, name, address, city, phone, logo_url, invite_code, owner_id)')
        .eq('doctor_id', doctorId!)
        .single()
      // PGRST116 = aucune ligne ("single()" sur 0 résultat) : cas légitime
      // "ce médecin n'a pas de cabinet". Toute autre erreur (réseau, RLS,
      // timeout) était traitée pareil avant ce correctif — un blip réseau
      // faisait passer un médecin membre d'un cabinet pour un médecin sans
      // cabinet, au lieu de laisser TanStack Query réessayer/signaler l'échec.
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
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
      return (data?.[0] ?? null) as {
        clinic_id: string; clinic_name: string; address: string | null; city: string | null
        phone: string | null; logo_url: string | null; lat: number | null; lng: number | null
      } | null
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

// ── SECRÉTARIAT DE CABINET ────────────────────────────────────────────────

// Crée l'accès secrétariat (Edge Function invite-clinic-secretary : compte
// créé côté serveur avec un mot de passe généré, jamais choisi par la
// secrétaire, envoyé par email avec le propriétaire du cabinet en copie).
// Contrairement à l'email de confirmation de RDV, l'appel n'est pas
// best-effort : c'est l'action elle-même, ses erreurs doivent remonter à
// l'écran (email déjà utilisé, etc.).
export function useInviteClinicSecretary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clinicId, email }: { clinicId: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke('invite-clinic-secretary', {
        body: { clinicId, email },
      })
      if (error) {
        // Sur une réponse non-2xx, supabase-js laisse `data` à null et met le
        // corps réel de la réponse dans `error.context` (un objet Response) —
        // sans ça, l'utilisateur ne voit que le message générique "Edge
        // Function returned a non-2xx status code" au lieu de l'erreur précise
        // renvoyée par la fonction (cabinet introuvable, email déjà utilisé...).
        let message = error.message
        try {
          const body = await (error as any).context?.json()
          if (body?.error) message = body.error
        } catch {}
        throw new Error(message)
      }
      if (data?.ok === false) throw new Error(data.error ?? "Erreur lors de l'invitation")
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic_staff_list', vars.clinicId] }),
  })
}

// Liste des secrétaires déjà invitées (onglet Secrétariat du tableau de
// bord praticien) — RPC réservée au propriétaire du cabinet.
export function useClinicStaffList(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic_staff_list', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clinic_staff_list', { p_clinic_id: clinicId })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

// Cabinet lié au compte secrétariat connecté via clinic_staff, pour
// amorcer son tableau de bord dédié. L'espace secrétariat est un compte
// à part entière (dashboard parallèle, jamais un accès ajouté à un
// compte praticien/patient existant) — restreint au rôle 'secretary'.
export function useMyClinicStaffInfo() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['my-clinic-staff-info', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_clinic_staff_info')
      if (error) throw error
      return data?.[0] ?? null
    },
    enabled: !!user && user.role === 'secretary',
  })
}

// Agenda du cabinet (tous les praticiens membres) sur une période — RPC
// autorisée au propriétaire, à un membre secrétariat, ou à un praticien du
// même cabinet (voir migration 048).
export function useClinicAgenda(clinicId?: string, from?: Date, to?: Date) {
  return useQuery({
    queryKey: ['clinic-agenda', clinicId, from?.toDateString(), to?.toDateString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clinic_agenda', {
        p_clinic_id: clinicId,
        p_from: from!.toISOString(),
        p_to: to!.toISOString(),
      })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId && !!from && !!to,
  })
}

// Patientèle agrégée du cabinet — même autorisation que useClinicAgenda.
export function useClinicPatients(clinicId?: string) {
  return useQuery({
    queryKey: ['clinic-patients', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clinic_patients', { p_clinic_id: clinicId })
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
      // `profiles!patient_id(...)` n'est pas un embed valide : patient_id
      // référence `users`, pas `profiles` directement (PostgREST renvoie
      // "Could not find a relationship"). Et un embed via `users!patient_id`
      // est bloqué par le RLS pour un praticien qui n'est ni l'utilisateur
      // ni admin (revient null silencieusement). Donc : deux requêtes
      // séparées puis fusion côté client, comme pour "Mes patients".
      // Colonnes explicites plutôt que "*" : voir useDoctorAppointments,
      // même raison (notes verrouillée en lecture, migration 080).
      const { data, error } = await supabase
        .from('appointments')
        .select(`id, patient_id, doctor_id, start_at, end_at, status, reason, confirmed_by_patient_at,
          doctors!inner(specialty, user_id, profiles!doctors_user_id_profiles_fkey(first_name, last_name)),
          appointment_animals(animals(id, name, species))
        `)
        .in('doctor_id', doctorIds)
        .order('start_at')
      if (error) throw error

      const patientIds = [...new Set((data ?? []).map((a: any) => a.patient_id))]
      const ownerNames = new Map<string, { first_name: string; last_name: string }>()
      if (patientIds.length > 0) {
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', patientIds)
        if (profErr) throw profErr
        ;(profilesData ?? []).forEach((p: any) => ownerNames.set(p.user_id, p))
      }

      return (data ?? []).map((a: any) => ({
        ...a,
        patientProfile: ownerNames.get(a.patient_id) ?? null,
        animals: (a.appointment_animals ?? []).map((link: any) => link.animals).filter(Boolean),
      }))
    },
    enabled: !!clinicId,
    // Un RDV pris par un patient avec un collègue doit apparaître dans
    // l'agenda partagé sans que le praticien qui regarde le calendrier
    // ait besoin de recharger la page.
    refetchInterval: 10000,
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
        .select('*, doctors(id, user_id, specialty, profiles!doctors_user_id_profiles_fkey(first_name, last_name))')
        .eq('clinic_id', clinicId!)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}

// Chaque membre du cabinet inscrit ses propres tarifs — la RPC détermine
// elle-même l'auteur (via auth.uid()) et vérifie l'appartenance au cabinet,
// impossible de créer un tarif au nom d'un autre praticien.
export function useAddClinicService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clinicId, name, price, duration }: { clinicId: string; name: string; price: number | null; duration: string }) => {
      const { error } = await supabase.rpc('add_clinic_service', {
        p_clinic_id: clinicId, p_name: name, p_price: price, p_duration: duration,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic_services', vars.clinicId] }),
  })
}

// Suppression réservée au praticien propriétaire du tarif, ou à l'admin du
// cabinet (vérifié côté RPC).
export function useDeleteClinicService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; clinicId: string }) => {
      const { error } = await supabase.rpc('delete_clinic_service', { p_service_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['clinic_services', vars.clinicId] }),
  })
}

// Tarifs personnels d'un praticien SANS cabinet — même table que les
// tarifs de cabinet (clinic_services), mais avec clinic_id = null. Écriture
// directe (pas de RPC nécessaire) car il n'y a pas de logique
// cross-utilisateur à vérifier : le RLS suffit (voir migration 045).
export function useDoctorServices(doctorId?: string) {
  return useQuery({
    queryKey: ['doctor_services', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_services')
        .select('*')
        .eq('doctor_id', doctorId!)
        .is('clinic_id', null)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!doctorId,
  })
}

export function useAddDoctorService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ doctorId, name, price, duration }: { doctorId: string; name: string; price: number | null; duration: string }) => {
      const { error } = await supabase
        .from('clinic_services')
        .insert({ doctor_id: doctorId, clinic_id: null, name, price, duration })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['doctor_services', vars.doctorId] }),
  })
}

export function useDeleteDoctorService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; doctorId: string }) => {
      const { error } = await supabase.from('clinic_services').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['doctor_services', vars.doctorId] }),
  })
}

export function useUpdateClinic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, address, city, phone, logo_url }: { id: string; name: string; address?: string; city?: string; phone?: string; logo_url?: string }) => {
      const updates: Record<string, any> = { name, address, city, phone }
      if (logo_url !== undefined) updates.logo_url = logo_url
      const coords = await geocodeAddress(address, city)
      if (coords) { updates.lat = coords.lat; updates.lng = coords.lng }
      const { error } = await supabase
        .from('clinics')
        .update(updates)
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
      avatar_url?: string
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
      // setProfile(data) est la vraie source de vérité lue partout (store
      // Zustand) — aucun useQuery(['profile']) n'existe dans le code,
      // l'invalidation qui était ici ne faisait donc rien.
      setProfile(data)
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
      accepted_species?: string[]
      home_visit?: boolean
    }) => {
      if (!user) throw new Error('Utilisateur non connecté')
      const payload: typeof updates & { lat?: number; lng?: number } = { ...updates }
      if (updates.city !== undefined || updates.address !== undefined) {
        const coords = await geocodeAddress(updates.address, updates.city)
        if (coords) { payload.lat = coords.lat; payload.lng = coords.lng }
      }
      const { error } = await supabase
        .from('doctors')
        .update(payload)
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

// Droit à la portabilité (RGPD, art. 20) — agrège toutes les données
// personnelles de l'utilisateur connecté via une RPC SECURITY DEFINER
// (voir migration 050_export_my_data.sql) et renvoie l'objet JSON brut ;
// le composant appelant se charge de proposer le téléchargement.
export function useExportMyData() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('export_my_data')
      if (error) throw new Error(error.message)
      return data
    },
  })
}

// ── NOTIFICATIONS PUSH NAVIGATEUR ──────────────────────────────────────────

export function usePushSubscriptionStatus() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['push-subscription-status', user?.id],
    queryFn: async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { supported: false, subscribed: false }
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      return { supported: true, subscribed: !!subscription }
    },
    enabled: !!user,
  })
}

export function useEnablePushNotifications() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Permission refusée pour les notifications.')

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY as string) as BufferSource,
      })
      const json = subscription.toJSON()

      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user!.id,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      }, { onConflict: 'user_id,endpoint' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-subscription-status'] }),
  })
}

export function useDisablePushNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return
      // Erreur non vérifiée auparavant : si la suppression échouait (RLS,
      // réseau), on désabonnait quand même côté navigateur — la ligne
      // restait en base, et un futur envoi de rappel tentait de livrer vers
      // un endpoint mort.
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      if (error) throw error
      await subscription.unsubscribe()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-subscription-status'] }),
  })
}

// ── VÉRIFICATION PRATICIEN (documents justificatifs) ──────────────────────────

export function useDoctorVerificationDocuments(doctorId?: string) {
  return useQuery({
    queryKey: ['doctor_verification_documents', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_verification_documents')
        .select('*')
        .eq('doctor_id', doctorId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      // file_url stocke le CHEMIN de stockage (pas une URL signée figée) —
      // un lien signé à durée fixe stocké tel quel expirait sans jamais
      // pouvoir être régénéré, cassant l'examen des documents par l'admin
      // un an après coup. Re-signé à chaque lecture, valable 1h. Les lignes
      // créées avant ce correctif ont encore une URL complète (commence par
      // http) en base : on la garde telle quelle plutôt que de la re-signer.
      const withFreshUrls = await Promise.all((data ?? []).map(async (doc: any) => {
        if (!doc.file_url || doc.file_url.startsWith('http')) return doc
        const { data: signed } = await supabase.storage
          .from('verification-documents')
          .createSignedUrl(doc.file_url, 60 * 60)
        return signed?.signedUrl ? { ...doc, file_url: signed.signedUrl } : doc
      }))
      return withFreshUrls
    },
    enabled: !!doctorId,
  })
}

export function useUploadVerificationDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ doctorId, file, documentType }: { doctorId: string; file: File; documentType: string }) => {
      const ext = file.name.split('.').pop()
      const path = `${doctorId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('verification-documents').upload(path, file)
      if (uploadError) throw uploadError
      const { error } = await supabase.from('doctor_verification_documents').insert({
        doctor_id: doctorId,
        file_url: path,
        file_name: file.name,
        document_type: documentType,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['doctor_verification_documents', vars.doctorId] }),
  })
}

export function useDeleteVerificationDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; doctorId: string }) => {
      const { error } = await supabase.from('doctor_verification_documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['doctor_verification_documents', vars.doctorId] }),
  })
}

// ── ADMINISTRATION — vérification des praticiens ───────────────────────────────
// RPC SECURITY DEFINER (migration 051) : chacune vérifie is_admin() côté
// serveur, indépendamment de ce que le client envoie.

export function useAdminPendingDoctors() {
  return useQuery({
    queryKey: ['admin_pending_doctors'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_pending_doctors')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

export function useAdminPendingDoctorsCount() {
  return useQuery({
    queryKey: ['admin_pending_doctors_count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_pending_doctors_count')
      if (error) throw error
      return (data ?? 0) as number
    },
  })
}

export function useAdminReviewDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ doctorId, approve, reason }: { doctorId: string; approve: boolean; reason?: string }) => {
      const { error } = await supabase.rpc('admin_review_doctor', {
        p_doctor_id: doctorId,
        p_approve: approve,
        p_reason: reason ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_pending_doctors'] })
      qc.invalidateQueries({ queryKey: ['admin_pending_doctors_count'] })
      qc.invalidateQueries({ queryKey: ['admin_doctors_by_status'] })
      qc.invalidateQueries({ queryKey: ['admin_platform_stats'] })
    },
  })
}

// Vue d'ensemble de la plateforme (compteurs + séries pour les graphiques)
// — migration 056, complétée en migration 057 (signups_weekly,
// appointments_by_status).
export function useAdminPlatformStats() {
  return useQuery({
    queryKey: ['admin_platform_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_platform_stats')
      if (error) throw error
      return data as {
        patients_count: number; doctors_count: number; doctors_pending: number
        doctors_verified: number; doctors_rejected: number; secretaries_count: number
        clinics_count: number; appointments_total: number; appointments_upcoming: number
        reviews_count: number; reports_pending: number
        signups_weekly: { week_start: string; doctors: number; patients: number }[]
        appointments_by_status: { pending: number; confirmed: number; completed: number; cancelled: number; no_show: number }
      }
    },
  })
}

// Dossier complet des praticiens (profil + documents) filtrable par statut
// de vérification — contrairement à useAdminPendingDoctors, couvre aussi
// les praticiens déjà validés ou rejetés (migration 056).
export function useAdminDoctorsByStatus(status: 'pending' | 'verified' | 'rejected' | null) {
  return useQuery({
    queryKey: ['admin_doctors_by_status', status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_doctors_by_status', { p_status: status })
      if (error) throw error
      return (data ?? []) as any[]
    },
    // p_status=null renvoie TOUS les praticiens de la plateforme (voir la
    // RPC) — sans ce garde-fou, les deux appels "verified"/"rejected" de
    // AdminDashboard passaient status=null au chargement de l'onglet
    // "pending" par défaut et déclenchaient chacun un fetch complet inutile.
    enabled: status !== null,
  })
}

// Fiche praticien exhaustive (coordonnées, cabinet, statistiques de
// rendez-vous) pour la vue détail cliquée depuis une liste — migration 057.
export function useAdminDoctorDetail(doctorId: string | null) {
  return useQuery({
    queryKey: ['admin_doctor_detail', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_doctor_detail', { p_doctor_id: doctorId })
      if (error) throw error
      return data as any
    },
    enabled: !!doctorId,
  })
}

// Tous les avis de la plateforme, pour repérer les avis très négatifs
// depuis la carte "Avis publiés" de la vue d'ensemble admin — tri/filtre
// (note, date) gérés côté client vu le faible volume (migration 058).
export function useAdminReviews() {
  return useQuery({
    queryKey: ['admin_reviews'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_reviews')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

// Profils propriétaires d'animaux — symétrique aux dossiers praticiens,
// atteint depuis la carte "Propriétaires" de la vue d'ensemble admin
// (migration 059).
export function useAdminPatients() {
  return useQuery({
    queryKey: ['admin_patients'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_patients')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

export function useAdminPatientDetail(userId: string | null) {
  return useQuery({
    queryKey: ['admin_patient_detail', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_patient_detail', { p_user_id: userId })
      if (error) throw error
      return data as any
    },
    enabled: !!userId,
  })
}

// Dossiers cabinets — troisième type de profil consultable depuis l'espace
// admin, atteint depuis la carte "Cabinets" de la vue d'ensemble (migration 060).
export function useAdminClinics() {
  return useQuery({
    queryKey: ['admin_clinics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_clinics')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

export function useAdminClinicDetail(clinicId: string | null) {
  return useQuery({
    queryKey: ['admin_clinic_detail', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_clinic_detail', { p_clinic_id: clinicId })
      if (error) throw error
      return data as any
    },
    enabled: !!clinicId,
  })
}

// Comptes secrétariat — atteint depuis la carte "Secrétariats" de la vue
// d'ensemble admin (migration 061). Chaque ligne renvoie vers la fiche
// du cabinet associé (AdminClinicDetail), pas de fiche dédiée séparée.
export function useAdminSecretaries() {
  return useQuery({
    queryKey: ['admin_secretaries'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_secretaries')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

// Rendez-vous de la plateforme (500 plus récents), atteint depuis les
// cartes "RDV à venir" / "RDV au total" de la vue d'ensemble admin
// (migration 061) — filtre appliqué côté client.
export function useAdminAppointments() {
  return useQuery({
    queryKey: ['admin_appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_appointments')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

// ── ADMINISTRATION — modération avancée (migration 063) ────────────────────
// Suppression d'avis, suspension de compte, signalements, journal d'actions.

// Signaler un avis ou un praticien — utilisable par n'importe quel
// utilisateur connecté (bouton "Signaler" sur DoctorPage).
export function useCreateReport() {
  return useMutation({
    mutationFn: async ({ targetType, targetId, reason }: { targetType: 'review' | 'doctor'; targetId: string; reason: string }) => {
      const { error } = await supabase.rpc('create_report', {
        p_target_type: targetType, p_target_id: targetId, p_reason: reason,
      })
      if (error) throw error
    },
  })
}

export function useAdminReports() {
  return useQuery({
    queryKey: ['admin_reports'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_reports')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}

export function useAdminResolveReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reportId, status, note }: { reportId: string; status: 'resolved' | 'dismissed'; note?: string }) => {
      const { error } = await supabase.rpc('admin_resolve_report', {
        p_report_id: reportId, p_status: status, p_note: note ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_reports'] })
      qc.invalidateQueries({ queryKey: ['admin_platform_stats'] })
      qc.invalidateQueries({ queryKey: ['admin_actions_log'] })
    },
  })
}

export function useAdminDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.rpc('admin_delete_review', { p_review_id: reviewId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_reviews'] })
      qc.invalidateQueries({ queryKey: ['admin_platform_stats'] })
      qc.invalidateQueries({ queryKey: ['admin_actions_log'] })
    },
  })
}

export function useAdminSuspendUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const { error } = await supabase.rpc('admin_suspend_user', { p_user_id: userId, p_reason: reason ?? null })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_patient_detail'] })
      qc.invalidateQueries({ queryKey: ['admin_doctor_detail'] })
      qc.invalidateQueries({ queryKey: ['admin_actions_log'] })
    },
  })
}

export function useAdminUnsuspendUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_unsuspend_user', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_patient_detail'] })
      qc.invalidateQueries({ queryKey: ['admin_doctor_detail'] })
      qc.invalidateQueries({ queryKey: ['admin_actions_log'] })
    },
  })
}

export function useAdminActionsLog() {
  return useQuery({
    queryKey: ['admin_actions_log'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_actions_log')
      if (error) throw error
      return (data ?? []) as any[]
    },
  })
}
