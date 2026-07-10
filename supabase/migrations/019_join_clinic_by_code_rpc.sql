-- Bug : "Rejoindre un cabinet" avec un code d'invitation valide échouait
-- ("Code invalide ou cabinet introuvable") pour tout praticien qui n'était
-- pas déjà membre du cabinet. Cause : useJoinClinic faisait un
-- `select id from clinics where invite_code = ...` directement depuis le
-- client, et la policy RLS sur `clinics` ne permet probablement de lire
-- qu'un cabinet dont on est déjà owner/membre — donc la recherche par code
-- ne retournait jamais de ligne, même avec le bon code. Même famille de bug
-- que celle déjà rencontrée sur `users`/`profiles` (RLS bloque la
-- visibilité cross-utilisateur), corrigée ici avec une RPC SECURITY DEFINER
-- qui fait la recherche ET l'ajout à clinic_members de façon atomique,
-- contournant le RLS comme les autres RPC déjà en place dans le projet.

create or replace function public.join_clinic_by_code(p_invite_code text, p_doctor_id uuid)
returns table (clinic_id uuid, clinic_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  select id into v_clinic_id
  from clinics
  where invite_code = upper(p_invite_code);

  if v_clinic_id is null then
    raise exception 'Code invalide ou cabinet introuvable';
  end if;

  if exists (
    select 1 from clinic_members
    where clinic_id = v_clinic_id and doctor_id = p_doctor_id
  ) then
    raise exception 'Vous êtes déjà membre de ce cabinet';
  end if;

  insert into clinic_members (clinic_id, doctor_id) values (v_clinic_id, p_doctor_id);

  return query select c.id, c.name from clinics c where c.id = v_clinic_id;
end;
$$;

grant execute on function public.join_clinic_by_code(text, uuid) to authenticated;
