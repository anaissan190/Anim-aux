-- ============================================================
-- Coordonnées du cabinet dans get_doctor_clinic (carte fiche praticien)
-- ============================================================
-- La carte Leaflet de la fiche praticien publique (section 6.5) n'utilisait
-- que doctors.lat/lng, jamais celles du cabinet — un praticien membre d'un
-- cabinet (dont l'adresse affichée est celle du cabinet, pas la sienne)
-- n'avait donc jamais de coordonnées personnelles renseignées et la carte
-- restait vide. get_doctor_clinic() expose désormais aussi les
-- coordonnées du cabinet (clinics.lat/lng, déjà géocodées automatiquement
-- à chaque mise à jour d'adresse par useUpdateClinic) pour que le
-- frontend puisse s'y rabattre.

drop function if exists public.get_doctor_clinic(uuid);
create or replace function public.get_doctor_clinic(p_doctor_id uuid)
returns table (
  clinic_id uuid, clinic_name text, address text, city text, phone text, logo_url text,
  lat decimal(9,6), lng decimal(9,6)
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.address, c.city, c.phone, c.logo_url, c.lat, c.lng
  from clinic_members cm
  join clinics c on c.id = cm.clinic_id
  where cm.doctor_id = p_doctor_id
  limit 1;
$$;

grant execute on function public.get_doctor_clinic(uuid) to anon, authenticated;
