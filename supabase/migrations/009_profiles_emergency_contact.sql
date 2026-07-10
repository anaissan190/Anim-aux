-- Ajoute un contact d'urgence au profil (facultatif). L'adresse postale
-- (profiles.address) existe déjà depuis le schéma initial mais n'était pas
-- exposée dans l'interface — pas de migration nécessaire pour elle.
alter table public.profiles
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
