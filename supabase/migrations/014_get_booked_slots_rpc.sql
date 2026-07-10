-- La policy RLS "appointments: patient voit les siens" limite un patient à
-- ses propres RDV, donc la vérification "ce créneau est-il déjà pris ?" ne
-- voyait jamais les RDV des AUTRES patients avec le même praticien — un
-- créneau réservé par quelqu'un d'autre réapparaissait comme disponible.
-- Cette fonction ne renvoie que les horaires occupés (pas l'identité du
-- patient ni le motif), pour permettre à n'importe quel utilisateur connecté
-- de vérifier la disponibilité sans exposer les RDV des autres.
create or replace function public.get_booked_slots(p_doctor_id uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select a.start_at
  from public.appointments a
  where a.doctor_id = p_doctor_id
    and a.start_at >= p_from
    and a.start_at < p_to
    and a.status in ('pending', 'confirmed')
$$;

grant execute on function public.get_booked_slots(uuid, timestamptz, timestamptz) to authenticated;
