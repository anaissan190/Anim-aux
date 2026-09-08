-- 091_revert_specialties_communication_mediation_photo.sql
-- Retour en arrière sur la migration 090 : Anaïs a finalement décidé de ne
-- pas ajouter ces trois métiers (le 08/09/2026, juste après leur ajout).
-- practitionerTypes.ts a été révoqué en parallèle côté front — cette
-- migration retire les entrées correspondantes de la table specialties
-- (autocomplétion de la recherche) pour rester en miroir.
delete from public.specialties
where name in ('Communication animale', 'Médiation animale', 'Photographe animalier');
