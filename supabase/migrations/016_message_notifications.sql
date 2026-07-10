-- Crée automatiquement une notification pour le destinataire à chaque nouveau
-- message (jusqu'ici : la table `notifications` existait mais rien n'y
-- insérait de ligne pour les messages, donc la cloche ne signalait jamais
-- rien). SECURITY DEFINER : nécessaire car l'expéditeur n'a pas le droit
-- d'insérer une notification pour un autre utilisateur (RLS), comme pour le
-- trigger update_doctor_rating existant.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, related_id)
  values (
    NEW.receiver_id,
    'new_message',
    'Nouveau message',
    left(NEW.content, 120),
    NEW.sender_id
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
after insert on public.messages
for each row execute function public.notify_new_message();
