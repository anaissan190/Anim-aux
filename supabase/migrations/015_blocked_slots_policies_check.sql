-- La table blocked_slots existe déjà depuis le schéma initial (001) avec ses
-- policies RLS, mais n'était utilisée nulle part dans le code jusqu'ici. Vu
-- les incidents passés (policies/fonctions disparues en prod), on réaffirme
-- ces policies par sécurité avant de brancher la fonctionnalité "congés".
alter table public.blocked_slots enable row level security;

drop policy if exists "blocked_slots: lecture publique" on public.blocked_slots;
create policy "blocked_slots: lecture publique" on public.blocked_slots for select using (true);

drop policy if exists "blocked_slots: médecin gère les siens" on public.blocked_slots;
create policy "blocked_slots: médecin gère les siens" on public.blocked_slots
  for all using (
    auth.uid() = (select user_id from public.doctors where id = doctor_id)
  )
  with check (
    auth.uid() = (select user_id from public.doctors where id = doctor_id)
  );
