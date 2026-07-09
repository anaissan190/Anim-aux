-- ============================================================
-- ANIMÉAUX — Vérifie/rétablit l'autorisation de créer un avis
-- Cette policy était déjà prévue dans le schéma initial, mais vu
-- les incidents récents (fonctions et policies disparues), on la
-- réaffirme ici par sécurité. À coller dans Supabase → SQL Editor → Run.
-- ============================================================

alter table public.reviews enable row level security;

drop policy if exists "reviews: patient crée après RDV" on public.reviews;
create policy "reviews: patient crée après RDV" on public.reviews for insert with check (
  auth.uid() = patient_id and
  exists (
    select 1 from public.appointments
    where id = appointment_id and patient_id = auth.uid() and status = 'completed'
  )
);

drop policy if exists "reviews: lecture publique" on public.reviews;
create policy "reviews: lecture publique" on public.reviews for select using (true);
