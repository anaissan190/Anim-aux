-- 037_remove_eleveur_ethologue.sql
-- Retire "Éleveur canin ou équin" et "Éthologue" de la liste des métiers
-- proposés dans l'appli.

delete from public.specialties where name in ('Éleveur canin ou équin', 'Éthologue');
