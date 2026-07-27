-- ============================================================
-- Rappels de vaccin proactifs (email + SMS + notification in-app)
-- ============================================================
-- vaccines.next_due_date existait déjà et était affiché passivement sur
-- /rappels, mais rien ne prévenait le propriétaire proactivement. La
-- fonction Edge send-reminders (cron horaire) envoie désormais aussi un
-- rappel dans les 7 jours précédant l'échéance, une seule fois par vaccin
-- (reminder_sent_at empêche les envois répétés tant que la date reste
-- dans cette fenêtre).

alter type notification_type add value if not exists 'vaccine_reminder';

alter table public.vaccines add column if not exists reminder_sent_at timestamptz;
