-- ============================================================
-- ANIMÉAUX — Corrige l'annulation de RDV côté patient, cassée depuis
-- toujours (001_schema.sql)
--
-- La policy d'origine n'avait pas de clause WITH CHECK explicite :
--   for update using (auth.uid() = patient_id and status in ('pending', 'confirmed'))
-- Sans WITH CHECK, Postgres réutilise la clause USING pour valider aussi
-- la ligne APRÈS modification — qui exige donc status in ('pending',
-- 'confirmed'). Or annuler consiste justement à passer le statut à
-- 'cancelled', qui ne fait pas partie de cette liste : la ligne finale
-- viole systématiquement la policy, et Postgres rejette la mise à jour
-- (silencieusement côté UI, aucun toast d'erreur n'étant câblé sur ce
-- bouton). Confirmé en conditions réelles le 30/07/2026 : cliquer sur
-- "Annuler" en tant que patient ne faisait rien.
--
-- Le WITH CHECK ci-dessous distingue explicitement OLD (via USING,
-- inchangé) et NEW (le patient ne peut faire passer son propre RDV
-- qu'à 'cancelled' précisément, jamais à 'completed'/'no_show' qui
-- restent réservés au praticien).
-- ============================================================

drop policy if exists "appointments: patient peut annuler le sien" on public.appointments;

create policy "appointments: patient peut annuler le sien" on public.appointments
  for update
  using (auth.uid() = patient_id and status in ('pending', 'confirmed'))
  with check (auth.uid() = patient_id and status = 'cancelled');
