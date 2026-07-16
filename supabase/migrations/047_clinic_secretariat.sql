-- ============================================================
-- ANIMÉAUX — Espace secrétariat de cabinet.
-- Nouveau rôle `secretary`, invité par le propriétaire d'un cabinet
-- (compte créé côté serveur par l'Edge Function invite-clinic-secretary,
-- mot de passe généré — jamais choisi par la secrétaire). Le compte
-- n'a pas de ligne `doctors` (handle_new_user ne fait de traitement
-- spécial que pour role = 'doctor', donc rien à changer côté trigger).
--
-- clinic_members.doctor_id est une FK dure vers doctors(id) : impossible
-- d'y rattacher une secrétaire. On crée donc une table séparée
-- clinic_staff plutôt que de toucher clinic_members/clinics, dont les
-- policies ont déjà causé deux bugs de récursion (migrations 040/041).
-- Toutes les nouvelles lectures passent par des RPC SECURITY DEFINER,
-- même principe que get_clinic_team/get_clinic_info (migration 034) —
-- aucune policy existante n'est modifiée ou supprimée.
-- ============================================================

alter type public.user_role add value if not exists 'secretary';
