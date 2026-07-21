-- ============================================================
-- Trace la preuve d'acceptation des CGU / politique de confidentialité
-- ============================================================
-- Jusqu'ici, la case à cocher à l'inscription (RegisterPage.tsx) ne
-- bloquait que la soumission du formulaire côté client : rien n'était
-- enregistré côté serveur pour prouver qu'un utilisateur donné a bien
-- accepté les CGU, ni à quelle date. En cas de litige, impossible de
-- le démontrer. Cette migration ajoute une colonne horodatée, remplie
-- par handle_new_user() uniquement si le client transmet explicitement
-- terms_accepted=true dans les métadonnées d'inscription.

alter table public.users add column if not exists terms_accepted_at timestamptz;

create or replace function handle_new_user()
returns trigger as $$
declare
  user_role_val user_role;
begin
  user_role_val := coalesce((NEW.raw_user_meta_data->>'role')::user_role, 'patient');

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
$$ language plpgsql security definer;
