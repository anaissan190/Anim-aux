-- Fix : "column reference "clinic_id" is ambiguous"
-- `returns table (clinic_id uuid, clinic_name text)` crée une variable
-- implicite `clinic_id` dans le corps de la fonction, qui entrait en
-- conflit avec la colonne `clinic_members.clinic_id` référencée sans alias
-- dans le `exists (...)`. Correction : on alias systématiquement les tables
-- et on qualifie les colonnes pour lever toute ambiguïté.

create or replace function public.join_clinic_by_code(p_invite_code text, p_doctor_id uuid)
returns table (clinic_id uuid, clinic_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  select c.id into v_clinic_id
  from clinics c
  where c.invite_code = upper(p_invite_code);

  if v_clinic_id is null then
    raise exception 'Code invalide ou cabinet introuvable';
  end if;

  if exists (
    select 1 from clinic_members cm
    where cm.clinic_id = v_clinic_id and cm.doctor_id = p_doctor_id
  ) then
    raise exception 'Vous êtes déjà membre de ce cabinet';
  end if;

  insert into clinic_members (clinic_id, doctor_id) values (v_clinic_id, p_doctor_id);

  return query select c.id, c.name from clinics c where c.id = v_clinic_id;
end;
$$;

grant execute on function public.join_clinic_by_code(text, uuid) to authenticated;
