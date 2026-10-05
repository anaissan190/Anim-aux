-- Diagnostic en LECTURE SEULE — ne modifie aucune donnée.
-- Pourquoi un praticien ne voit-il pas (ou plus) un animal ?
-- Règle en vigueur (migration 116) : le praticien — ou un confrère de son
-- cabinet — voit l'animal tant qu'il existe un rendez-vous CONFIRMÉ ou TERMINÉ
-- datant de MOINS D'UN AN (futur compris). Annulé / absent ne comptent pas.
--
-- Remplace 'NOM_ANIMAL' par le nom exact de l'animal, puis colle tout dans
-- Supabase → SQL Editor → Run. Chaque ligne = un rendez-vous du propriétaire ;
-- la colonne "compte_comme_lien_de_soin" dit s'il ouvre l'accès à son praticien.
select
  an.id as animal_id,
  an.name as animal_nom,
  an.owner_id,
  a.id as appointment_id,
  a.doctor_id as appointment_doctor_id,
  a.status as appointment_status,
  a.start_at,
  (a.status in ('confirmed', 'completed') and a.start_at > now() - interval '1 year') as compte_comme_lien_de_soin,
  cm.clinic_id as doctor_est_membre_du_cabinet
from public.animals an
left join public.appointments a on a.patient_id = an.owner_id
left join public.clinic_members cm on cm.doctor_id = a.doctor_id
where an.name ilike 'NOM_ANIMAL'
order by a.start_at;
