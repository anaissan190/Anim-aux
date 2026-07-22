-- ============================================================
-- L'administrateur plateforme n'est plus un rôle exclusif
-- ============================================================
-- Jusqu'ici, is_admin() vérifiait role = 'admin' : un compte admin ne
-- pouvait donc pas AUSSI être un compte propriétaire d'animal normal
-- (role est une valeur unique). En pratique, la fondatrice utilise son
-- compte personnel (propriétaire d'animal) à la fois pour ses propres
-- animaux et pour valider les praticiens : le mettre en role = 'admin'
-- lui faisait perdre l'accès à son tableau de bord propriétaire.
--
-- is_admin devient un booléen indépendant du rôle principal du compte :
-- n'importe quel compte (patient, praticien, secrétariat) peut aussi
-- être administrateur, sans perdre son tableau de bord habituel.

alter table public.users add column if not exists is_admin boolean not null default false;

-- Migration des comptes existants : quiconque avait role = 'admin' devient
-- is_admin = true, puis repasse à role = 'patient' (rôle par défaut d'un
-- compte personnel — c'était le rôle d'origine du compte de la fondatrice
-- avant qu'il ne soit basculé en 'admin' pour la fonctionnalité de
-- vérification des praticiens).
update public.users set is_admin = true where role = 'admin';
update public.users set role = 'patient' where role = 'admin';

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and is_admin = true
  );
$$;

create or replace function public.get_my_user_data()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'role', u.role,
    'is_admin', u.is_admin,
    'profile', to_json(p.*)
  )
  into result
  from public.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid();

  return result;
end;
$$;

-- La policy historique testait role = 'admin' en dur plutôt que d'utiliser
-- is_admin() : on l'aligne pour qu'elle suive la même source de vérité.
drop policy if exists "users: admin voit tout" on public.users;
create policy "users: admin voit tout" on public.users for select using (is_admin());
