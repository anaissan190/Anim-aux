-- 092_ethics_charter.sql
-- Engagement bien-être animal (différenciateur face à Tobalgo, dont la
-- charte éthique co-écrite avec Argos 42 est leur argument principal) :
-- case à cocher obligatoire à l'inscription praticien, horodatée comme
-- terms_accepted_at (migration 049) pour en garder la preuve. Colonne
-- posée sur doctors (pas users) : seuls les praticiens sont concernés.
alter table public.doctors add column if not exists ethics_charter_accepted_at timestamptz;

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
    insert into public.doctors (user_id, specialty, ethics_charter_accepted_at)
    values (
      NEW.id,
      coalesce(NEW.raw_user_meta_data->>'specialty', ''),
      case when (NEW.raw_user_meta_data->>'ethics_charter_accepted')::boolean is true then now() else null end
    )
    on conflict (user_id) do nothing;
  end if;

  return NEW;
end;
$$;
