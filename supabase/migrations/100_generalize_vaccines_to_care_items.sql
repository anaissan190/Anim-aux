-- ============================================================
-- ANIMÉAUX — Généralise `vaccines` en `care_items` (23/09/2026)
-- ============================================================
-- Demande d'Anaïs : étendre les rappels au-delà des seuls vaccins
-- (vermifuge, bilan annuel...). Plutôt que dupliquer toute la mécanique
-- vaccins (table, RLS, trigger, cron de rappel, UI) pour chaque nouveau
-- type de suivi, cette migration généralise la table `vaccines`
-- elle-même : renommée en `care_items`, avec une colonne `care_type` qui
-- distingue vaccin / vermifuge / bilan annuel / autre. Structure et RLS
-- identiques à `vaccines` par ailleurs (voir 081_animal_records_
-- hardening_and_recovery.sql pour la version d'origine) — rien d'autre
-- ne change dans les autorisations, uniquement le nom de la table et
-- l'ajout de `care_type`.
--
-- ALTER TABLE ... RENAME conserve automatiquement les données, les
-- contraintes de clé étrangère et les policies RLS existantes (Postgres
-- les retrouve par OID, pas par nom) — aucune perte, aucune réécriture
-- de données nécessaire. On recrée seulement les policies avec leur nom
-- affiché à jour ("care_items: ..." au lieu de "vaccines: ...") pour que
-- la liste reste lisible dans le dashboard Supabase.
-- ============================================================

alter table public.vaccines rename to care_items;

alter table public.care_items
  add column if not exists care_type text not null default 'vaccine';

alter table public.care_items
  drop constraint if exists care_items_care_type_check;
alter table public.care_items
  add constraint care_items_care_type_check
  check (care_type in ('vaccine', 'deworming', 'checkup', 'other'));

alter index if exists idx_vaccines_animal rename to idx_care_items_animal;

-- ── Trigger de verrouillage animal_id (même fonction partagée que
--    weight_tracking/health_records, voir 081) ────────────────────────
drop trigger if exists vaccines_prevent_reassignment on public.care_items;
create trigger care_items_prevent_reassignment
before update on public.care_items
for each row execute function prevent_animal_record_reassignment();

-- ── Policies RLS (renommées "care_items: ...", logique strictement
--    identique à celle de "vaccines: ..." dans 081) ────────────────────
drop policy if exists "vaccines: médecin voit celles des animaux de ses patients" on public.care_items;
create policy "care_items: médecin voit ceux des animaux de ses patients" on public.care_items for select using (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = care_items.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);
drop policy if exists "vaccines: médecin peut ajouter" on public.care_items;
create policy "care_items: médecin peut ajouter" on public.care_items for insert with check (
  exists (
    select 1 from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    where an.id = care_items.animal_id
      and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
      and a.status in ('confirmed', 'completed')
  )
);
drop policy if exists "vaccines: propriétaire modifie" on public.care_items;
create policy "care_items: propriétaire modifie" on public.care_items for update
  using (exists (select 1 from public.animals where id = care_items.animal_id and owner_id = auth.uid()));
drop policy if exists "vaccines: propriétaire supprime" on public.care_items;
create policy "care_items: propriétaire supprime" on public.care_items for delete
  using (exists (select 1 from public.animals where id = care_items.animal_id and owner_id = auth.uid()));
drop policy if exists "vaccines: médecin modifie celles des animaux de ses patients" on public.care_items;
create policy "care_items: médecin modifie ceux des animaux de ses patients" on public.care_items for update
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = care_items.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );
drop policy if exists "vaccines: médecin supprime celles des animaux de ses patients" on public.care_items;
create policy "care_items: médecin supprime ceux des animaux de ses patients" on public.care_items for delete
  using (
    exists (
      select 1 from public.animals an
      join public.appointments a on a.patient_id = an.owner_id
      where an.id = care_items.animal_id
        and a.doctor_id = (select id from public.doctors where user_id = auth.uid())
        and a.status in ('confirmed', 'completed')
    )
  );
drop policy if exists "vaccines: médecin voit ceux des patients de son cabinet" on public.care_items;
create policy "care_items: médecin voit ceux des patients de son cabinet" on public.care_items for select using (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = care_items.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);
drop policy if exists "vaccines: médecin peut ajouter pour son cabinet" on public.care_items;
create policy "care_items: médecin peut ajouter pour son cabinet" on public.care_items for insert with check (
  exists (
    select 1
    from public.animals an
    join public.appointments a on a.patient_id = an.owner_id
    join public.clinic_members cm_collegue on cm_collegue.doctor_id = a.doctor_id
    join public.clinic_members cm_moi on cm_moi.clinic_id = cm_collegue.clinic_id
    where an.id = care_items.animal_id
      and cm_moi.doctor_id = (select id from public.doctors where user_id = auth.uid())
  )
);

-- ── Nouveau type de notification, générique (remplace vaccine_reminder
--    pour tout nouveau rappel — vaccine_reminder reste dans l'enum pour
--    les lignes déjà existantes, jamais supprimé). ─────────────────────
alter type notification_type add value if not exists 'care_reminder';

notify pgrst, 'reload schema';
