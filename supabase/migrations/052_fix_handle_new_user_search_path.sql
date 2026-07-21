-- ============================================================
-- Correctif urgent : inscriptions cassées (type "user_role" introuvable)
-- ============================================================
-- handle_new_user() référençait le type user_role sans le qualifier par son
-- schéma (public.user_role) ni fixer explicitement search_path. Le rôle
-- technique supabase_auth_admin, qui exécute ce trigger à chaque inscription
-- (SECURITY DEFINER hérite du search_path de l'appelant, pas du propriétaire),
-- n'a apparemment plus "public" dans son search_path par défaut : plus
-- aucune inscription (patient ou praticien) n'aboutissait depuis le 21
-- juillet 2026 (~23h15), avec l'erreur "Database error saving new user".
-- Fixer search_path explicitement est par ailleurs la pratique recommandée
-- pour toute fonction SECURITY DEFINER (indépendamment de la cause exacte).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role_val public.user_role;
begin
  user_role_val := coalesce((NEW.raw_user_meta_data->>'role')::public.user_role, 'patient');

  insert into public.users (id, email, role, terms_accepted_at)
  values (
    NEW.id,
    NEW.email,
    user_role_val,
    case when (NEW.raw_user_meta_data->>'terms_accepted')::boolean is true then now() else null end
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, first_name, last_name)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'first_name', ''),
    coalesce(NEW.raw_user_meta_data->>'last_name', '')
  )
  on conflict (user_id) do nothing;

  if user_role_val = 'doctor' then
    insert into public.doctors (user_id, specialty)
    values (NEW.id, coalesce(NEW.raw_user_meta_data->>'specialty', ''))
    on conflict (user_id) do nothing;
  end if;

  return NEW;
end;
$$;
