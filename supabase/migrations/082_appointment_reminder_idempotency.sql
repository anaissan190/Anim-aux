-- ============================================================
-- ANIMÉAUX — Garde-fou anti-doublon sur le rappel de RDV à 24h.
-- Les deux autres boucles de send-reminders (vaccin, avis) marquent déjà
-- une colonne "déjà envoyé" avant de passer à la ligne suivante
-- (reminder_sent_at sur vaccines, review_reminder_sent_at sur
-- appointments) pour survivre à une ré-exécution horaire. La boucle des
-- rappels de RDV à 24h n'avait aucun équivalent : un second déclenchement
-- de la fonction pour la même heure (retry manuel après timeout, cron
-- qui se chevauche, redéploiement qui relance le cycle) renvoyait un
-- email + SMS en double à tous les patients concernés.
-- ============================================================

alter table public.appointments
  add column if not exists reminder_24h_sent_at timestamptz;
