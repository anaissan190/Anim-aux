-- ============================================================
-- ANIMÉAUX — Documents & photos
-- Permet :
--  1) au praticien d'ajouter des documents/photos dans le dossier
--     d'un animal (nouvel onglet "Documents" de AnimalHealthPage) ;
--  2) au propriétaire de l'animal d'en ajouter aussi (dossier ET
--     lors de la prise de RDV, pièce jointe liée au rendez-vous).
-- À coller dans Supabase → SQL Editor → Run.
-- ============================================================

-- ============================================================
-- STORAGE — bucket "documents"
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "documents: lecture publique" on storage.objects;
create policy "documents: lecture publique" on storage.objects for select
  using (bucket_id = 'documents');

drop policy if exists "documents: envoi par utilisateur connecté" on storage.objects;
create policy "documents: envoi par utilisateur connecté" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');

drop policy if exists "documents: remplacement par utilisateur connecté" on storage.objects;
create policy "documents: remplacement par utilisateur connecté" on storage.objects for update
  to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

drop policy if exists "documents: suppression par le propriétaire du fichier" on storage.objects;
create policy "documents: suppression par le propriétaire du fichier" on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());

-- ============================================================
-- TABLE — animal_documents (dossier de l'animal, onglet Documents)
-- ============================================================
create table if not exists public.animal_documents (
  id          uuid primary key default gen_random_uuid(),
  animal_id   uuid not null references public.animals(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_url    text not null,
  file_name   text not null,
  file_type   text,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_animal_documents_animal on public.animal_documents(animal_id);

alter table public.animal_documents enable row level security;

-- Lecture : propriétaire de l'animal
drop policy if exists "animal_documents: propriétaire voit les siens" on public.animal_documents;
create policy "animal_documents: propriétaire voit les siens" on public.animal_documents for select using (
  exists (select 1 from public.animals an where an.id = animal_documents.animal_id and an.owner_id = auth.uid())
);

-- Lecture : praticien avec RDV confirmé/terminé avec le propriétaire
drop policy if exists "animal_documents: médecin voit ceux des animaux de ses patients" on public.animal_documents;
create policy "animal_documents: médecin voit ceux des animaux de ses patients" on public.animal_documents for select using (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = animal_documents.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- Ajout : propriétaire
drop policy if exists "animal_documents: propriétaire ajoute" on public.animal_documents;
create policy "animal_documents: propriétaire ajoute" on public.animal_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.animals an where an.id = animal_documents.animal_id and an.owner_id = auth.uid())
);

-- Ajout : praticien
drop policy if exists "animal_documents: médecin peut ajouter" on public.animal_documents;
create policy "animal_documents: médecin peut ajouter" on public.animal_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = animal_documents.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);

-- Suppression : chacun supprime uniquement ce qu'il a lui-même envoyé
drop policy if exists "animal_documents: suppression par l'auteur" on public.animal_documents;
create policy "animal_documents: suppression par l'auteur" on public.animal_documents for delete using (
  uploaded_by = auth.uid()
);

-- ============================================================
-- TABLE — appointment_documents (pièces jointes lors de la prise de RDV)
-- ============================================================
create table if not exists public.appointment_documents (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  uploaded_by    uuid not null references auth.users(id) on delete cascade,
  file_url       text not null,
  file_name      text not null,
  file_type      text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_appointment_documents_appointment on public.appointment_documents(appointment_id);

alter table public.appointment_documents enable row level security;

-- Lecture : le patient concerné
drop policy if exists "appointment_documents: patient voit les siens" on public.appointment_documents;
create policy "appointment_documents: patient voit les siens" on public.appointment_documents for select using (
  exists (select 1 from public.appointments a where a.id = appointment_documents.appointment_id and a.patient_id = auth.uid())
);

-- Lecture : le praticien du RDV
drop policy if exists "appointment_documents: médecin voit ceux de ses RDV" on public.appointment_documents;
create policy "appointment_documents: médecin voit ceux de ses RDV" on public.appointment_documents for select using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_documents.appointment_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- Ajout : le patient, uniquement sur son propre RDV
drop policy if exists "appointment_documents: patient ajoute" on public.appointment_documents;
create policy "appointment_documents: patient ajoute" on public.appointment_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.appointments a where a.id = appointment_documents.appointment_id and a.patient_id = auth.uid())
);

-- Suppression : l'auteur uniquement
drop policy if exists "appointment_documents: suppression par l'auteur" on public.appointment_documents;
create policy "appointment_documents: suppression par l'auteur" on public.appointment_documents for delete using (
  uploaded_by = auth.uid()
);
