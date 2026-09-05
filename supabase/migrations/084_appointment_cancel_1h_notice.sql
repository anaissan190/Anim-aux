-- ============================================================
-- ANIMÉAUX — Délai minimum d'1h avant de pouvoir annuler un RDV (patient)
-- ============================================================
-- Jusqu'ici, un patient pouvait annuler jusqu'à la dernière minute (aucune
-- contrainte de délai dans la policy 069). Décision du 04/09/2026 : borne
-- à 1h avant l'heure du RDV, plus souple que le délai de 24h retenu pour
-- la reprogrammation (083) — l'annulation reste possible en cas
-- d'imprévu de dernière minute (maladie, urgence), contrairement au
-- report qui redonne un vrai nouveau créneau au praticien.
-- ============================================================

drop policy if exists "appointments: patient peut annuler le sien" on public.appointments;

create policy "appointments: patient peut annuler le sien" on public.appointments
  for update
  using (auth.uid() = patient_id and status in ('pending', 'confirmed') and start_at > now() + interval '1 hour')
  with check (auth.uid() = patient_id and status = 'cancelled');
