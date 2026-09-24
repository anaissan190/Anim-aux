-- ============================================================
-- ANIMÉAUX — Relance des patients inactifs (25/09/2026)
-- ============================================================
-- Notifie un patient dont le dernier RDV terminé remonte à plus de 6 mois
-- et qui n'a pas déjà reçu cette relance — même mécanique que les rappels
-- de suivi/avis déjà en place dans send-reminders (Edge Function).
--
-- reengagement_reminder_sent_at vit sur `appointments` (comme
-- review_reminder_sent_at) plutôt que sur `users`, pour rester cohérent
-- avec le patron déjà utilisé ici : on marque le DERNIER RDV terminé du
-- patient comme "déjà relancé", identifié côté Edge Function (le SQL seul
-- ne peut pas facilement exprimer "le plus récent par patient" sans RPC
-- dédiée, la fonction fait déjà ce regroupement en mémoire).
-- ============================================================

alter table public.appointments
  add column if not exists reengagement_reminder_sent_at timestamptz;

alter type notification_type add value if not exists 'reengagement_reminder';

notify pgrst, 'reload schema';
