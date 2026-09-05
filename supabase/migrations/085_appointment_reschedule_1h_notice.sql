-- ============================================================
-- ANIMÉAUX — Aligne le délai de report patient sur celui de l'annulation
-- ============================================================
-- Le délai de 24h retenu en 083 est réduit à 1h, sur demande d'Anaïs,
-- pour rester cohérent avec le délai d'annulation (084).
-- ============================================================

drop policy if exists "appointments: patient peut reporter le sien" on public.appointments;
create policy "appointments: patient peut reporter le sien" on public.appointments
  for update
  using (auth.uid() = patient_id and status = 'confirmed' and start_at > now() + interval '1 hour')
  with check (auth.uid() = patient_id and status = 'confirmed');
