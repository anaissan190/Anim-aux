-- La fiche publique d'un praticien (/doctor/:id, accessible sans connexion)
-- n'affichait jamais l'adresse du cabinet quand le praticien en est membre
-- (elle n'affichait que l'adresse personnelle du praticien). Un embed direct
-- `clinic_members -> clinics` depuis le client serait bloqué par le RLS
-- (policy réservée aux membres/owner du cabinet, même famille de bug que
-- pour "Rejoindre un cabinet"). On expose donc une RPC SECURITY DEFINER,
-- volontairement minimale : uniquement nom/adresse/ville, jamais
-- l'invite_code qui doit rester privé au cabinet.

create or replace function public.get_doctor_clinic(p_doctor_id uuid)
returns table (clinic_id uuid, clinic_name text, address text, city text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city
  from clinic_members cm
  join clinics c on c.id = cm.clinic_id
  where cm.doctor_id = p_doctor_id
  limit 1;
$$;

-- Accessible même sans connexion : la fiche praticien est publique.
grant execute on function public.get_doctor_clinic(uuid) to anon, authenticated;
