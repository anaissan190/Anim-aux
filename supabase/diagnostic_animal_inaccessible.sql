-- Diagnostic en LECTURE SEULE — ne modifie aucune donnée.
-- Remplace 'NOM_ANIMAL' par le nom exact de l'animal qui ne s'ouvre pas,
-- puis colle tout dans Supabase → SQL Editor → Run.

select
  an.id as animal_id,
  an.name as animal_nom,
  an.owner_id,
  a.id as appointment_id,
  a.doctor_id as appointment_doctor_id,
  a.status as appointment_status,
  cm.clinic_id as doctor_est_membre_du_cabinet
from public.animals an
left join public.appointments a on a.patient_id = an.owner_id
left join public.clinic_members cm on cm.doctor_id = a.doctor_id
where an.name ilike 'NOM_ANIMAL'
order by a.start_at;
