-- Autorise un patient à laisser plusieurs avis sur un même praticien
-- (la contrainte "un seul avis par patient/praticien" ajoutée en 011 était
-- trop restrictive pour tester/utiliser la fonctionnalité normalement).
alter table public.reviews
  drop constraint if exists reviews_patient_doctor_unique;
