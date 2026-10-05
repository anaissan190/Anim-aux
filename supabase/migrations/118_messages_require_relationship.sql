-- 118_messages_require_relationship.sql
-- Audit du 05/10/2026 : la policy d'insertion de `messages` (001) n'exigeait que
-- sender_id = auth.uid() — n'importe quel utilisateur connecté pouvait écrire à
-- n'importe quel autre (spam, harcèlement, notification push non sollicitée),
-- la restriction "uniquement les praticiens avec qui on a un rendez-vous" n'étant
-- appliquée que par l'écran (MessagesPage.tsx).
--
-- Règle côté base, miroir de l'écran : on peut écrire à quelqu'un si
--   * il existe un rendez-vous entre les deux (quel que soit son statut) ;
--   * ou la personne nous a déjà écrit (on peut lui répondre) ;
--   * ou l'expéditeur est administrateur.
-- Policy RESTRICTIVE : elle réduit ce que permet la policy existante sans la
-- toucher (même technique que la migration 109). La relation est lue par une
-- fonction security definer pour éviter toute récursion RLS (messages ->
-- appointments -> doctors...), comme has_appointment_with_doctor (097).
--
-- Retour arrière si la messagerie se comportait mal :
--   drop policy "messages: relation existante requise" on public.messages;
create or replace function public.can_message(p_sender uuid, p_receiver uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.appointments a
      join public.doctors d on d.id = a.doctor_id
      where (a.patient_id = p_sender and d.user_id = p_receiver)
         or (a.patient_id = p_receiver and d.user_id = p_sender)
    )
    or exists (
      select 1 from public.messages m
      where m.sender_id = p_receiver and m.receiver_id = p_sender
    )
    or exists (
      select 1 from public.users u where u.id = p_sender and u.is_admin
    )
$$;

grant execute on function public.can_message(uuid, uuid) to authenticated;

drop policy if exists "messages: relation existante requise" on public.messages;
create policy "messages: relation existante requise" on public.messages
  as restrictive
  for insert
  with check (public.can_message(sender_id, receiver_id));
