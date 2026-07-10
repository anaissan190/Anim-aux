-- Le cabinet doit pouvoir afficher un numéro de téléphone (renseigné par
-- l'admin/créateur du cabinet), distinct du téléphone personnel de chaque
-- praticien membre.

alter table public.clinics add column if not exists phone text;

-- Mise à jour de la RPC publique (fiche praticien) pour exposer aussi ce
-- numéro, en plus du nom/adresse déjà renvoyés. Le type de retour change
-- (nouvelle colonne) : `create or replace` seul échoue dans ce cas, il faut
-- d'abord supprimer l'ancienne version.
drop function if exists public.get_doctor_clinic(uuid);

create or replace function public.get_doctor_clinic(p_doctor_id uuid)
returns table (clinic_id uuid, clinic_name text, address text, city text, phone text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone
  from clinic_members cm
  join clinics c on c.id = cm.clinic_id
  where cm.doctor_id = p_doctor_id
  limit 1;
$$;

grant execute on function public.get_doctor_clinic(uuid) to anon, authenticated;
