-- ============================================================
-- ANIMÉAUX — Modification et suppression des mesures de poids
-- Jusqu'ici, seules la lecture et l'ajout étaient autorisées sur
-- weight_tracking. Ajoute les autorisations UPDATE/DELETE pour le
-- propriétaire de l'animal et pour le praticien suivant celui-ci
-- (RDV confirmé ou terminé). À coller dans Supabase → SQL Editor → Run.
-- ============================================================

alter table public.weight_tracking enable row level security;

-- Le propriétaire de l'animal peut modifier ses mesures
drop policy if exists "weight_tracking: propriétaire modifie" on public.weight_tracking;
create policy "weight_tracking: propriétaire modifie" on public.weight_tracking for update
  using (
    exists (
      select 1 from public.animals
      where id = weight_tracking.animal_id and owner_id = auth.uid()
    )
  );

-- Le propriétaire de l'animal peut supprimer ses mesures
drop policy if exists "weight_tracking: propriétaire supprime" on public.weight_tracking;
create policy "weight_tracking: propriétaire supprime" on public.weight_tracking for delete
  using (
    exists (
      select 1 from public.animals
      where id = weight_tracking.animal_id and owner_id = auth.uid()
    )
  );

-- Le praticien suivant l'animal (RDV confirmé/terminé) peut modifier une mesure
drop policy if exists "weight_tracking: médecin modifie celles des animaux de ses patients" on public.weight_tracking;
create policy "weight_tracking: médecin modifie celles des animaux de ses patients" on public.weight_tracking for update
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = weight_tracking.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );

-- Le praticien suivant l'animal (RDV confirmé/terminé) peut supprimer une mesure
drop policy if exists "weight_tracking: médecin supprime celles des animaux de ses patients" on public.weight_tracking;
create policy "weight_tracking: médecin supprime celles des animaux de ses patients" on public.weight_tracking for delete
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = weight_tracking.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );
