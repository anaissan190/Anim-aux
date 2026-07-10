// src/types/index.ts
// Types TypeScript alignés sur le schéma Supabase

export type UserRole = 'patient' | 'doctor' | 'admin'
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type NotificationType =
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  | 'new_message'
  | 'new_review'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone?: string
  avatar_url?: string
  date_of_birth?: string
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  created_at: string
  updated_at: string
}

export interface Doctor {
  id: string
  user_id: string
  specialty: string
  rpps_number?: string
  bio?: string
  consultation_price: number
  address?: string
  city?: string
  lat?: number
  lng?: number
  is_verified: boolean
  average_rating: number
  review_count: number
  created_at: string
  // Jointures
  profiles?: Profile
  users?: User
}

export interface Availability {
  id: string
  doctor_id: string
  day_of_week: number // 0=Dim, 1=Lun, ...6=Sam
  start_time: string  // "09:00"
  end_time: string    // "18:00"
  slot_duration_minutes: number
  is_active: boolean
}

export interface BlockedSlot {
  id: string
  doctor_id: string
  start_at: string
  end_at: string
  reason?: string
}

export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  animal_id?: string
  start_at: string
  end_at: string
  status: AppointmentStatus
  reason?: string
  notes?: string
  created_at: string
  updated_at: string
  // Jointures
  doctors?: Doctor & { profiles?: Profile }
  profiles?: Profile // profil du patient
  animals?: { id: string; name: string; species: string; avatar_url?: string }[]
  reviews?: { id: string; rating: number; comment?: string }[]
}

export interface Review {
  id: string
  appointment_id: string
  patient_id: string
  doctor_id: string
  rating: number
  comment?: string
  created_at: string
  profiles?: Profile
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  appointment_id?: string
  content: string
  is_read: boolean
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  related_id?: string
  created_at: string
}

export interface TimeSlot {
  start: Date
  end: Date
  available: boolean
}

export interface SearchFilters {
  specialty?: string
  city?: string
  name?: string
  maxPrice?: number
  minRating?: number
  availableDate?: string
}
