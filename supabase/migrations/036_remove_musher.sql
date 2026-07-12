-- 036_remove_musher.sql
-- Retire "Musher" de la liste des métiers proposés dans l'appli.

delete from public.specialties where name = 'Musher';
