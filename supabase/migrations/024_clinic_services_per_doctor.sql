-- Jusqu'ici, seul le créateur du cabinet pouvait ajouter des tarifs
-- (clinic_services partagé, sans notion de propriétaire). Chaque membre du
-- cabinet doit pouvoir inscrire ses PROPRES tarifs, affichés ensuite
-- regroupés par praticien. On ajoute donc un doctor_id, et on passe par des
-- RPC SECURITY DEFINER pour garantir les bonnes permissions sans dépendre
-- du détail du RLS existant sur clinic_services (table créée hors des
-- migrations committées) : chacun ne gère que ses propres tarifs, l'admin
-- du cabinet peut en plus tout supprimer.

alter table public.clinic_services add column if not exists doctor_id uuid references public.doctors(id) on delete cascade;

create or replace function public.add_clinic_service(p_clinic_id uuid, p_name text, p_price numeric, p_duration text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
begin
  select id into v_doctor_id from doctors where user_id = auth.uid();
  if v_doctor_id is null then
    raise exception 'Praticien introuvable';
  end if;

  if not exists (
    select 1 from clinic_members
    where clinic_id = p_clinic_id and doctor_id = v_doctor_id
  ) then
    raise exception 'Vous n''êtes pas membre de ce cabinet';
  end if;

  insert into clinic_services (clinic_id, doctor_id, name, price, duration)
  values (p_clinic_id, v_doctor_id, p_name, p_price, p_duration);
end;
$$;

grant execute on function public.add_clinic_service(uuid, text, numeric, text) to authenticated;

create or replace function public.delete_clinic_service(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_doctor_id uuid;
  v_clinic_id uuid;
  v_caller_doctor_id uuid;
begin
  select doctor_id, clinic_id into v_service_doctor_id, v_clinic_id
  from clinic_services where id = p_service_id;

  if v_clinic_id is null then
    raise exception 'Tarif introuvable';
  end if;

  select id into v_caller_doctor_id from doctors where user_id = auth.uid();

  if v_service_doctor_id is distinct from v_caller_doctor_id
     and not exists (select 1 from clinics where id = v_clinic_id and owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez supprimer que vos propres tarifs';
  end if;

  delete from clinic_services where id = p_service_id;
end;
$$;

grant execute on function public.delete_clinic_service(uuid) to authenticated;
