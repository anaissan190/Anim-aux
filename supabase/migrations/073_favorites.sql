-- "Favoris" : un patient peut enregistrer un praticien pour un accès
-- rapide depuis l'accueil, indépendamment de tout historique de RDV.
-- Même schéma RLS que waitlist_entries (migration 065) : propriétaire
-- uniquement, une seule policy "for all".

create table if not exists public.favorites (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  patient_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (doctor_id, patient_id)
);

create index if not exists idx_favorites_patient on public.favorites(patient_id);
create index if not exists idx_favorites_doctor on public.favorites(doctor_id);

alter table public.favorites enable row level security;

create policy "favorites: patient gère les siens" on public.favorites
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
