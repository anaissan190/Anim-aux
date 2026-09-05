-- ============================================================
-- ANIMÉAUX — Flux calendrier abonnable pour le praticien (webcal/ICS)
-- ============================================================
-- Jusqu'ici, exporter un RDV dans son calendrier personnel se faisait un
-- par un (bouton "Ajouter à mon calendrier", generateAppointmentIcs).
-- Ajoute un flux ICS unique par praticien, à coller une fois dans Google/
-- Apple Calendar ("s'abonner à partir d'une URL") : tout l'agenda se
-- synchronise ensuite automatiquement, sans ré-export manuel.
--
-- Le jeton n'est SURTOUT PAS une colonne sur `doctors` : cette table a une
-- policy "lecture publique" (select using (true)), utilisée par
-- useDoctor/useDoctors avec select('*') sur la fiche praticien publique et
-- les résultats de recherche — un jeton stocké là serait exposé à
-- n'importe quel visiteur du site, exactement le type de fuite RLS
-- niveau colonne corrigé la veille (079/080/081). Table séparée,
-- entièrement fermée au public, seul le praticien concerné peut la lire/
-- écrire.
-- ============================================================

create table if not exists public.doctor_calendar_tokens (
  doctor_id uuid primary key references public.doctors(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.doctor_calendar_tokens enable row level security;
-- Aucune policy publique : uniquement via les deux RPC ci-dessous, qui
-- résolvent le doctor_id depuis auth.uid() elles-mêmes (le client ne
-- passe jamais de doctor_id en paramètre, pour éviter tout risque d'IDOR).

create or replace function public.get_my_calendar_feed_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
  v_token uuid;
begin
  select id into v_doctor_id from public.doctors where user_id = auth.uid();
  if v_doctor_id is null then
    raise exception 'Réservé aux praticiens';
  end if;

  insert into public.doctor_calendar_tokens (doctor_id)
  values (v_doctor_id)
  on conflict (doctor_id) do nothing;

  select token into v_token from public.doctor_calendar_tokens where doctor_id = v_doctor_id;
  return v_token;
end;
$$;

grant execute on function public.get_my_calendar_feed_token() to authenticated;

create or replace function public.regenerate_my_calendar_feed_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id uuid;
  v_token uuid;
begin
  select id into v_doctor_id from public.doctors where user_id = auth.uid();
  if v_doctor_id is null then
    raise exception 'Réservé aux praticiens';
  end if;

  insert into public.doctor_calendar_tokens (doctor_id, token)
  values (v_doctor_id, gen_random_uuid())
  on conflict (doctor_id) do update set token = excluded.token;

  select token into v_token from public.doctor_calendar_tokens where doctor_id = v_doctor_id;
  return v_token;
end;
$$;

grant execute on function public.regenerate_my_calendar_feed_token() to authenticated;
