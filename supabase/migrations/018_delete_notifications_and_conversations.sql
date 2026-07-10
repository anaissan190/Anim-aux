-- Autorise la suppression des notifications (par leur destinataire) et des
-- messages (par l'expéditeur OU le destinataire, nécessaire pour pouvoir
-- supprimer une conversation entière : certains messages ont été reçus, pas
-- envoyés, par la personne qui supprime).

drop policy if exists "notifications: supprimer les siennes" on public.notifications;
create policy "notifications: supprimer les siennes" on public.notifications for delete using (
  auth.uid() = user_id
);

drop policy if exists "messages: supprimer si sender ou receiver" on public.messages;
create policy "messages: supprimer si sender ou receiver" on public.messages for delete using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);
