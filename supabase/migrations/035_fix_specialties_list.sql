-- 035_fix_specialties_list.sql
-- La table `specialties` contenait encore des spécialités de médecine
-- HUMAINE (Cardiologie, Dermatologie, Gynécologie...) laissées par erreur
-- depuis un modèle de départ générique. Elle sert à l'autocomplétion de la
-- barre de recherche (useSpecialties) et doit refléter la liste fermée des
-- métiers animaliers utilisée à l'inscription/l'édition de profil praticien
-- (voir src/lib/practitionerTypes.ts), pour qu'aucune autre possibilité que
-- cette liste (+ "Autre") ne soit proposée dans l'appli.

delete from public.specialties;

insert into public.specialties (name) values
('Vétérinaire'),
('Auxiliaire spécialisé vétérinaire (ASV)'),
('Ostéopathe animalier'),
('Kinésithérapeute animalier'),
('Hydrothérapeute animalier'),
('Dentiste équin'),
('Nutritionniste animalier'),
('Naturopathe animalier'),
('Comportementaliste animalier'),
('Éducateur canin'),
('Dresseur animalier'),
('Maître-chien'),
('Toiletteur'),
('Masseur canin'),
('Palefrenier'),
('Soigneur animalier'),
('Pet-sitter'),
('Autre')
on conflict (name) do nothing;
