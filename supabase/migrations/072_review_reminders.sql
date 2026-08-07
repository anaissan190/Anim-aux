-- Rappel automatique invitant le patient à laisser un avis quelques
-- heures après qu'un rendez-vous a été marqué "Terminé" par le
-- praticien (bouton sur AppointmentCard, voir useUpdateAppointmentStatus).
-- Envoyé par supabase/functions/send-reminders (cron horaire), même
-- schéma que le rappel de vaccin : completed_at sert de point de départ
-- à la fenêtre d'envoi, review_reminder_sent_at empêche tout renvoi.

alter type notification_type add value if not exists 'review_reminder';

alter table public.appointments
  add column if not exists completed_at timestamptz,
  add column if not exists review_reminder_sent_at timestamptz;
