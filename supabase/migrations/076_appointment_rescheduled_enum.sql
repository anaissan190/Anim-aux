-- Nouvelle valeur d'enum pour la notification "RDV reporté" (bouton
-- "Reporter" côté praticien sur un RDV confirmé, voir AppointmentCard.tsx).
-- Isolée dans sa propre migration, jamais combinée avec un insert qui
-- l'utilise dans le même script (une valeur d'enum ajoutée via ALTER TYPE
-- doit être déjà validée avant d'être utilisable ailleurs) — voir migration
-- 072 pour le même principe appliqué à 'review_reminder'.

alter type notification_type add value if not exists 'appointment_rescheduled';
