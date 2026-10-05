-- 115_remove_clinic_secretary.sql
-- Le créateur d'un cabinet pouvait inviter un compte secrétariat mais jamais le
-- retirer (le compte ne disparaissait qu'avec le cabinet — migration 114).
-- Cette RPC retire un compte secrétariat du cabinet : si ce compte n'est
-- rattaché à aucun autre cabinet, il est supprimé (c'est un compte dédié,
-- créé par invite-clinic-secretary — même règle que la fermeture de cabinet) ;
-- sinon seul son lien avec CE cabinet est retiré.
-- Réservé au créateur du cabinet (même contrôle que remove_clinic_member).
create or replace function public.remove_clinic_secretary(p_clinic_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.clinics where id = p_clinic_id and owner_id = auth.uid()) then
    raise exception 'Seul le créateur du cabinet peut retirer un compte secrétariat';
  end if;

  if not exists (select 1 from public.clinic_staff where clinic_id = p_clinic_id and user_id = p_user_id) then
    raise exception 'Compte secrétariat introuvable dans ce cabinet';
  end if;

  if exists (select 1 from public.users where id = p_user_id and role = 'secretary')
     and not exists (select 1 from public.clinic_staff where user_id = p_user_id and clinic_id <> p_clinic_id) then
    delete from auth.users where id = p_user_id;
  else
    delete from public.clinic_staff where clinic_id = p_clinic_id and user_id = p_user_id;
  end if;
end;
$$;

grant execute on function public.remove_clinic_secretary(uuid, uuid) to authenticated;
