-- Confirmation de présence patient sur le rappel de RDV à 24h : lien
-- public "Je confirme" (page /confirmer-presence/:id, fonction Edge
-- confirm-appointment-presence). Réduit le no-show et donne au praticien
-- une visibilité (badge sur AppointmentCard) avant l'heure du RDV.

alter table public.appointments
  add column if not exists confirmed_by_patient_at timestamptz;
