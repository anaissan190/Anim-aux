-- ============================================================
-- ANIMÉAUX — Corrige une récursion infinie introduite par la migration 039
-- La policy SELECT de clinic_members se référençait elle-même
-- ("suis-je membre du même cabinet que cette ligne ?"), ce qui déclenche
-- une boucle infinie à chaque évaluation ("infinite recursion detected in
-- policy for relation clinic_members") — et fait échouer en cascade toute
-- requête touchant clinics/clinic_services/animal_documents/
-- appointment_documents, qui consultent toutes clinic_members dans leurs
-- propres policies.
-- Solution classique : une fonction SECURITY DEFINER (contourne le RLS,
-- même principe que is_doctor()/get_my_doctor_id() déjà utilisées ailleurs
-- dans ce projet) pour faire la vérification sans redéclencher la policy.
-- ============================================================

create or replace function public.get_my_clinic_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select cm.clinic_id
  from clinic_members cm
  join doctors d on d.id = cm.doctor_id
  where d.user_id = auth.uid()
$$;

grant execute on function public.get_my_clinic_ids() to authenticated;

drop policy if exists "clinic_members: membres du même cabinet se voient" on public.clinic_members;
create policy "clinic_members: membres du même cabinet se voient" on public.clinic_members for select using (
  clinic_id in (select get_my_clinic_ids())
  or exists (select 1 from public.clinics c where c.id = clinic_members.clinic_id and c.owner_id = auth.uid())
);

notify pgrst, 'reload schema';
