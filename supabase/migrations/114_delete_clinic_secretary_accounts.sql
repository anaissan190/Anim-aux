-- 114_delete_clinic_secretary_accounts.sql
-- Fermeture de cabinet (112/113) : le lien clinic_staff disparaît en cascade,
-- mais le COMPTE secrétariat lui-même (créé par invite-clinic-secretary,
-- uniquement pour ce cabinet) restait en place, orphelin — son titulaire
-- pouvait toujours se connecter et tombait sur un espace vide. Demande
-- d'Anaïs le 05/10/2026 : l'espace secrétariat disparaît avec le cabinet.
--
-- Ne supprime que les comptes de rôle 'secretary' qui ne sont rattachés à
-- AUCUN autre cabinet. BEFORE DELETE : à ce stade les lignes clinic_staff
-- existent encore, on peut donc lister les comptes concernés. Le nom du
-- trigger ("zdelete") le fait passer APRÈS clinics_prevent_deletion_with_members
-- (ordre alphabétique) : si la suppression est refusée faute d'avoir retiré
-- les confrères, aucun compte secrétariat n'est touché (et la transaction
-- entière est de toute façon annulée). Même technique (delete from
-- auth.users en security definer) que delete_my_account().
create or replace function public.delete_clinic_secretary_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_user_id uuid;
begin
  for staff_user_id in
    select cs.user_id
    from public.clinic_staff cs
    join public.users u on u.id = cs.user_id
    where cs.clinic_id = old.id
      and u.role = 'secretary'
      and not exists (
        select 1 from public.clinic_staff other
        where other.user_id = cs.user_id and other.clinic_id <> old.id
      )
  loop
    delete from auth.users where id = staff_user_id;
  end loop;
  return old;
end;
$$;

drop trigger if exists clinics_zdelete_secretary_accounts on public.clinics;
create trigger clinics_zdelete_secretary_accounts
before delete on public.clinics
for each row execute function public.delete_clinic_secretary_accounts();
