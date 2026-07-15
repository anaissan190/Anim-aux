-- ============================================================
-- ANIMÉAUX — Un praticien membre d'un cabinet ne doit plus apparaître
-- individuellement dans les résultats de recherche : on ne doit le
-- trouver qu'en passant par la fiche du cabinet. `clinic_members` n'est
-- pas lisible publiquement (RLS réservé aux membres/owner), donc le
-- client ne peut pas savoir directement quels doctor_id exclure — cette
-- RPC SECURITY DEFINER expose uniquement la liste des doctor_id déjà
-- membres d'un cabinet (donnée non sensible, déjà déductible de
-- l'annuaire public des cabinets), rien d'autre.
-- ============================================================

create or replace function public.get_clinic_member_doctor_ids()
returns table (doctor_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select distinct cm.doctor_id from clinic_members cm
$$;

grant execute on function public.get_clinic_member_doctor_ids() to anon, authenticated;

notify pgrst, 'reload schema';
