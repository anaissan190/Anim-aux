-- 1) Le trigger de notification de message n'incluait pas le nom de
--    l'expéditeur (juste "Nouveau message" générique) : on le corrige pour
--    aller chercher son prénom/nom dans profiles.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
  into sender_name
  from public.profiles p
  where p.user_id = NEW.sender_id;

  insert into public.notifications (user_id, type, title, body, related_id)
  values (
    NEW.receiver_id,
    'new_message',
    case when sender_name is not null and sender_name <> ''
      then 'Nouveau message de ' || sender_name
      else 'Nouveau message'
    end,
    left(NEW.content, 120),
    NEW.sender_id
  );
  return NEW;
end;
$$;

-- 2) La liste de conversations reposait uniquement sur les contacts dérivés
--    des rendez-vous (appointments) : si cette relation ne remonte pas
--    correctement (permissions RLS, cas limites), la conversation reste
--    invisible même si des messages existent bel et bien. Cette fonction
--    construit la liste directement depuis la table `messages` (source de
--    vérité), avec le nom de l'interlocuteur, la date du dernier message et
--    le nombre de non-lus — sans dépendre des RDV.
create or replace function public.get_conversation_partners()
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  last_message_at timestamptz,
  last_message_content text,
  unread_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    max(m.created_at) as last_message_at,
    (array_agg(m.content order by m.created_at desc))[1] as last_message_content,
    count(*) filter (where m.receiver_id = auth.uid() and not m.is_read)::int as unread_count
  from public.messages m
  join public.profiles p
    on p.user_id = case when m.sender_id = auth.uid() then m.receiver_id else m.sender_id end
  where m.sender_id = auth.uid() or m.receiver_id = auth.uid()
  group by p.user_id, p.first_name, p.last_name, p.avatar_url
  order by max(m.created_at) desc;
end;
$$;

grant execute on function public.get_conversation_partners() to authenticated;
