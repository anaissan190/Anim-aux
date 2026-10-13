-- ============================================================
-- ANIMÉAUX — La messagerie est réservée à l'abonnement, dans les deux sens
-- (13/10/2026)
-- ============================================================
-- La migration 128 empêchait d'ÉCRIRE à un praticien en offre gratuite. Décision du
-- 13/10 : la messagerie fait partie de l'abonnement, donc un praticien gratuit ne
-- peut pas non plus ÉCRIRE (répondre à une ancienne conversation, par exemple).
-- Même policy restrictive, étendue à l'expéditeur ; l'administrateur reste exempté.
-- La lecture des messages déjà échangés n'est pas touchée.
--
-- Retour arrière : recréer la policy de la migration 128.
-- ============================================================

drop policy if exists "messages: praticien abonné requis" on public.messages;
create policy "messages: praticien abonné requis" on public.messages
  as restrictive
  for insert
  with check (
    is_admin()
    or (
      not public.is_free_plan_doctor_user(receiver_id)
      and not public.is_free_plan_doctor_user(sender_id)
    )
  );

notify pgrst, 'reload schema';
