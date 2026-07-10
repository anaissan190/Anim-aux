-- Permet de lier plusieurs animaux à un même rendez-vous (jusqu'ici un seul
-- animal via appointments.animal_id). On introduit une table de liaison et on
-- migre les données existantes ; l'ancienne colonne animal_id est conservée
-- pour ne rien casser mais n'est plus utilisée par l'application.

create table if not exists public.appointment_animals (
  appointment_id uuid references public.appointments(id) on delete cascade,
  animal_id      uuid references public.animals(id) on delete cascade,
  created_at     timestamptz default now(),
  primary key (appointment_id, animal_id)
);

-- Reprend les liens déjà existants (un seul animal par RDV jusqu'ici)
insert into public.appointment_animals (appointment_id, animal_id)
select id, animal_id from public.appointments
where animal_id is not null
on conflict do nothing;

alter table public.appointment_animals enable row level security;

drop policy if exists "appointment_animals: lecture patient ou praticien" on public.appointment_animals;
create policy "appointment_animals: lecture patient ou praticien" on public.appointment_animals for select using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_animals.appointment_id
      and (
        a.patient_id = auth.uid()
        or a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      )
  )
);

drop policy if exists "appointment_animals: patient peut lier ses animaux" on public.appointment_animals;
create policy "appointment_animals: patient peut lier ses animaux" on public.appointment_animals for insert with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_animals.appointment_id
      and a.patient_id = auth.uid()
  )
);

drop policy if exists "appointment_animals: patient peut supprimer un lien" on public.appointment_animals;
create policy "appointment_animals: patient peut supprimer un lien" on public.appointment_animals for delete using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_animals.appointment_id
      and a.patient_id = auth.uid()
  )
);
