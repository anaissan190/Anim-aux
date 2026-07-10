-- Ajoute un statut "no_show" (patient absent) à l'énum appointment_status.
-- Exécuter cette instruction seule, dans sa propre requête (Supabase → SQL
-- Editor → Run), avant de coller la migration suivante : PostgreSQL n'autorise
-- pas d'utiliser une nouvelle valeur d'énum dans la même transaction que celle
-- qui la crée.
alter type appointment_status add value if not exists 'no_show';
