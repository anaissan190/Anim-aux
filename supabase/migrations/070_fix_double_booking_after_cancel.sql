-- ============================================================
-- ANIMÉAUX — Un créneau libéré par annulation reste bloqué à la
-- réservation (001_schema.sql)
--
-- La contrainte d'origine ne tenait pas compte du statut :
--   constraint no_double_booking unique (doctor_id, start_at)
-- get_booked_slots() (014) exclut déjà les RDV 'cancelled' des créneaux
-- réservés, donc l'interface montre bien le créneau comme libre après
-- annulation — mais la ligne annulée existe toujours en base avec ce
-- même (doctor_id, start_at), et la contrainte unique globale bloque
-- toute nouvelle réservation dessus : le patient voit un créneau
-- "disponible" qu'il est en réalité impossible de réserver.
--
-- Remplacée par un index unique partiel, portant uniquement sur les
-- statuts qui bloquent réellement un créneau ('pending', 'confirmed')
-- — exactement le même filtre que get_booked_slots, pour que ce que
-- l'UI montre comme disponible corresponde toujours à ce que la base
-- autorise.
-- ============================================================

alter table public.appointments drop constraint if exists no_double_booking;

create unique index if not exists no_double_booking
  on public.appointments (doctor_id, start_at)
  where status in ('pending', 'confirmed');
