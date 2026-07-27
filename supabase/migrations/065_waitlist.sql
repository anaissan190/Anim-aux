-- ============================================================
-- Liste d'attente : alerte "un créneau s'est libéré"
-- ============================================================
-- Un patient peut s'inscrire sur la liste d'attente d'un praticien depuis
-- BookPage. Dès qu'un rendez-vous confirmé chez ce praticien passe au
-- statut 'cancelled', tous les patients en attente reçoivent une
-- notification in-app puis leur entrée est supprimée : l'alerte est à
-- usage unique (pas un abonnement permanent), et la suppression — plutôt
-- qu'un simple marquage "notifié" — permet de se réinscrire librement par
-- la suite sans se heurter à la contrainte d'unicité ci-dessous.

alter type notification_type add value if not exists 'waitlist_slot_available';

create table if not exists public.waitlist_entries (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  patient_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (doctor_id, patient_id)
);

create index if not exists idx_waitlist_doctor on public.waitlist_entries(doctor_id);

alter table public.waitlist_entries enable row level security;

-- Un patient ne gère que ses propres entrées (s'inscrire / se désinscrire /
-- voir s'il est déjà inscrit) — pas de visibilité praticien/admin pour
-- l'instant, hors périmètre du besoin initial.
create policy "waitlist: patient gère ses entrées" on public.waitlist_entries
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create or replace function public.notify_waitlist_on_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entry record;
  doctor_name text;
begin
  if NEW.status = 'cancelled' and OLD.status is distinct from 'cancelled' then
    select p.first_name || ' ' || p.last_name into doctor_name
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
    where d.id = NEW.doctor_id;

    for entry in
      select * from public.waitlist_entries where doctor_id = NEW.doctor_id
    loop
      insert into public.notifications (user_id, type, title, body, related_id)
      values (
        entry.patient_id,
        'waitlist_slot_available',
        'Un créneau s''est libéré',
        'Un créneau vient de se libérer chez ' || coalesce(doctor_name, 'ce praticien')
          || ' le ' || to_char(NEW.start_at at time zone 'Europe/Paris', 'DD/MM à HH24:MI') || '.',
        NEW.doctor_id
      );
      delete from public.waitlist_entries where id = entry.id;
    end loop;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_waitlist_on_cancellation on public.appointments;
create trigger trg_notify_waitlist_on_cancellation
after update on public.appointments
for each row execute function public.notify_waitlist_on_cancellation();
