-- ============================================================
-- ANIMÉAUX — Corrige la récursion croisée restante entre clinics et
-- clinic_members : la policy de "clinics" lit clinic_members directement,
-- et la policy de "clinic_members" lit clinics directement -> boucle
-- infinie entre les deux (la 040 n'avait cassé qu'un seul sens).
-- Ajout d'une seconde fonction SECURITY DEFINER pour l'autre sens, et les
-- deux policies n'accèdent plus qu'à des fonctions qui contournent le RLS,
-- plus jamais à l'autre table directement.
-- ============================================================

create or replace function public.is_clinic_owner(p_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from clinics where id = p_clinic_id and owner_id = auth.uid())
$$;

grant execute on function public.is_clinic_owner(uuid) to authenticated;

-- CLINICS : ne lit plus clinic_members directement.
drop policy if exists "clinics: owner et membres voient" on public.clinics;
create policy "clinics: owner et membres voient" on public.clinics for select using (
  owner_id = auth.uid()
  or id in (select get_my_clinic_ids())
);

-- CLINIC_MEMBERS : ne lit plus clinics directement.
drop policy if exists "clinic_members: membres du même cabinet se voient" on public.clinic_members;
create policy "clinic_members: membres du même cabinet se voient" on public.clinic_members for select using (
  clinic_id in (select get_my_clinic_ids())
  or is_clinic_owner(clinic_id)
);
drop policy if exists "clinic_members: owner ajoute" on public.clinic_members;
create policy "clinic_members: owner ajoute" on public.clinic_members for insert with check (
  is_clinic_owner(clinic_id)
);
drop policy if exists "clinic_members: owner supprime" on public.clinic_members;
create policy "clinic_members: owner supprime" on public.clinic_members for delete using (
  is_clinic_owner(clinic_id)
);

-- CLINIC_SERVICES : idem, plus de subquery directe sur les deux autres tables.
drop policy if exists "clinic_services: membres voient" on public.clinic_services;
create policy "clinic_services: membres voient" on public.clinic_services for select using (
  clinic_id in (select get_my_clinic_ids())
  or is_clinic_owner(clinic_id)
);

notify pgrst, 'reload schema';
