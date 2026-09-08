-- 090_add_specialties_communication_mediation_photo.sql
-- Trois nouveaux métiers ajoutés à la liste fermée
-- (src/lib/practitionerTypes.ts) suite à une comparaison avec un
-- concurrent (Tobalgo) le 08/09/2026 : Communication animale, Médiation
-- animale, Photographe animalier. La table specialties sert à
-- l'autocomplétion de la recherche (useSpecialties) et doit rester en
-- miroir de cette liste (voir migration 035).
insert into public.specialties (name) values
('Communication animale'),
('Médiation animale'),
('Photographe animalier')
on conflict (name) do nothing;
