-- 111_doctor_waitlist_count.sql
-- Statistiques praticien (section 7.8) : nombre de patients en liste
-- d'attente, affiché sur l'onglet Statistiques.
--
-- waitlist_entries (migration 065) n'a qu'une seule policy, réservée au
-- patient lui-même ("waitlist: patient gère ses entrées") — un praticien ne
-- peut aujourd'hui pas savoir combien de patients attendent un créneau chez
-- lui. Plutôt qu'une policy SELECT large (qui exposerait l'identité de
-- chaque patient en attente, jamais demandé), une RPC security definer qui
-- ne renvoie qu'un compte agrégé — même principe que les autres RPC de ce
-- fichier (get_conversation_partners, get_doctor_reviews) pour des données
-- qui ne doivent pas être lues ligne à ligne par le client.
create or replace function public.get_my_waitlist_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  my_doctor_id uuid;
  result integer;
begin
  select id into my_doctor_id from public.doctors where user_id = auth.uid();
  if my_doctor_id is null then
    return 0;
  end if;
  select count(*) into result from public.waitlist_entries where doctor_id = my_doctor_id;
  return result;
end;
$$;

grant execute on function public.get_my_waitlist_count() to authenticated;
