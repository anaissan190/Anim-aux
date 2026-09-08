-- get_clinic_agenda (migration 048) ne renvoyait pas la spécialité du
-- praticien : SecretaryDashboard.tsx affichait donc systématiquement
-- "Dr {prénom} {nom}", y compris pour un membre du cabinet qui n'est pas
-- vétérinaire (comportementaliste, toiletteur...). Ajout de doctor_specialty
-- pour permettre au front de choisir le bon intitulé (voir formatDoctorName
-- dans src/lib/practitionerTypes.ts).
-- La nouvelle colonne doctor_specialty change le type de retour (row type
-- des OUT parameters) : Postgres refuse un simple CREATE OR REPLACE dans ce
-- cas (42P13) et exige de supprimer la fonction avant de la recréer.
drop function if exists public.get_clinic_agenda(uuid, timestamptz, timestamptz);

create or replace function public.get_clinic_agenda(p_clinic_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, start_at timestamptz, end_at timestamptz, status appointment_status, reason text,
  doctor_id uuid, doctor_first_name text, doctor_last_name text, doctor_specialty text,
  patient_first_name text, patient_last_name text, animal_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.start_at, a.end_at, a.status, a.reason,
    d.id, dp.first_name, dp.last_name, d.specialty,
    pp.first_name, pp.last_name, an.name
  from appointments a
  join doctors d on d.id = a.doctor_id
  join profiles dp on dp.user_id = d.user_id
  left join profiles pp on pp.user_id = a.patient_id
  left join appointment_animals aa on aa.appointment_id = a.id
  left join animals an on an.id = aa.animal_id
  where d.id in (select doctor_id from clinic_members where clinic_id = p_clinic_id)
    and a.start_at >= p_from and a.start_at < p_to
    and (is_clinic_owner(p_clinic_id) or is_clinic_staff(p_clinic_id) or exists (
      select 1 from clinic_members cm join doctors d2 on d2.id = cm.doctor_id
      where cm.clinic_id = p_clinic_id and d2.user_id = auth.uid()
    ))
  order by a.start_at
$$;

grant execute on function public.get_clinic_agenda(uuid, timestamptz, timestamptz) to authenticated;
