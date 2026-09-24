-- ============================================================
-- ANIMÉAUX — Retire une policy RLS trop permissive sur animals
-- (23/09/2026)
-- ============================================================
-- "animals: vétérinaire peut voir" (081_animal_records_hardening_and_
-- recovery.sql) autorise N'IMPORTE QUEL praticien connecté à lire la
-- fiche de N'IMPORTE QUEL animal (nom, espèce, race, photo, owner_id),
-- sans aucun lien avec son propriétaire — repéré en étudiant l'accès aux
-- animaux avant d'ajouter le partage de dossier entre confrères.
--
-- Les données médicales (care_items/weight_tracking/health_records)
-- n'étaient déjà PAS concernées (aucune policy équivalente dessus) : seule
-- la fiche animal elle-même était trop ouverte. Aucune fonctionnalité
-- actuelle n'en dépend — aucune page ne liste "tous les animaux", seule
-- une fiche précise par id (AnimalHealthPage.tsx, AnimalRecordExportPage.
-- tsx). L'accès légitime reste couvert par "animals: médecin voit les
-- animaux de ses patients" (RDV) et "...de son cabinet" (collègue de
-- cabinet), toutes deux déjà correctement scopées.
-- ============================================================

drop policy if exists "animals: vétérinaire peut voir" on public.animals;

notify pgrst, 'reload schema';
