-- ============================================================
-- appointments.notes ("notes internes du médecin, invisibles au patient",
-- voir 001_schema.sql) n'était en réalité protégé que par convention côté
-- frontend : usePatientAppointments faisait select('*', ...), qui incluait
-- notes dans la réponse réseau envoyée au navigateur du patient (jamais
-- affiché à l'écran, mais visible en clair dans l'onglet réseau). Côté
-- écriture, "appointments: patient peut annuler le sien" (069) n'a de
-- WITH CHECK que sur status/patient_id : un patient pouvait en théorie
-- glisser un changement de notes dans le même appel qui annule son RDV.
--
-- En pratique, aucune UI ne lit ni n'écrit jamais ce champ aujourd'hui
-- (aucun formulaire médecin ne le renseigne) : on peut donc le verrouiller
-- des deux côtés sans casser de fonctionnalité existante.
--  1. Écriture : étend le trigger de la migration 079 pour remettre notes
--     à sa valeur si le modificateur n'est ni le médecin du RDV ni admin.
--  2. Lecture : retire le privilège SELECT sur cette colonne précise pour
--     authenticated — RLS filtre les LIGNES, pas les colonnes, donc c'est
--     le seul mécanisme qui empêche une requête API bricolée à la main de
--     la lire, y compris pour ses propres RDV.
-- ============================================================

create or replace function prevent_appointment_identity_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.patient_id is distinct from old.patient_id
      or new.doctor_id is distinct from old.doctor_id)
     and not is_admin() then
    new.patient_id := old.patient_id;
    new.doctor_id := old.doctor_id;
  end if;

  if (new.notes is distinct from old.notes)
     and not is_admin()
     and auth.uid() is distinct from (select user_id from public.doctors where id = old.doctor_id) then
    new.notes := old.notes;
  end if;

  return new;
end;
$$;

revoke select (notes) on public.appointments from authenticated;
