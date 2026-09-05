-- ============================================================
-- ANIMÉAUX — Ferme les deux limites assumées de l'audit du 05/09/2026
-- ============================================================

-- ============================================================
-- 1) verification_rejected_reason : fermeture complète (087 ne bloquait
--    que le rôle anon, un compte authentifié pouvait encore le lire
--    directement via l'API REST pour n'importe quel praticien).
-- ============================================================
-- Impossible de simplement étendre le revoke à `authenticated` : useDoctor/
-- useDoctors/useCurrentDoctor font tous un select('*') sur `doctors`, qui
-- échoue entièrement si le rôle appelant n'a le droit sur AUCUNE colonne du
-- select — donc le frontend doit d'abord arrêter d'utiliser select('*') sur
-- cette table (fait dans ce même commit, voir useData.ts) avant que ce
-- revoke ne soit sans danger.
revoke select (verification_rejected_reason) on public.doctors from authenticated;

-- Seule voie de lecture restante pour ce champ : le praticien concerné,
-- via cette RPC (résout doctor_id depuis auth.uid(), jamais depuis un
-- paramètre client). L'admin continue d'y accéder via ses propres RPC
-- (admin_list_pending_doctors, etc.), SECURITY DEFINER donc non affectées
-- par ce revoke.
create or replace function public.get_my_verification_rejected_reason()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select verification_rejected_reason from public.doctors where user_id = auth.uid();
$$;

grant execute on function public.get_my_verification_rejected_reason() to authenticated;

-- ============================================================
-- 2) Aucune validation serveur du créneau lors d'une création/un report
--    de RDV par le patient — il pouvait pousser un start_at hors des
--    disponibilités du praticien (voire pendant un congé déclaré) via un
--    appel API direct, en contournant le calcul de créneaux du client.
-- ============================================================
-- Ne s'applique qu'aux actions du patient concerné (jamais au praticien ni
-- à l'admin, qui gèrent leur planning en confiance). Vérifie l'heure de
-- DÉBUT du créneau contre les disponibilités actives du praticien pour ce
-- jour de la semaine — pas l'heure de fin, car le calcul client actuel
-- (generateAvailableSlots, src/lib/slots.ts) génère volontairement le
-- dernier créneau d'une plage même si sa fin dépasse légèrement
-- l'horaire déclaré (ex. plage 9h-9h50 avec des créneaux de 30 min : le
-- créneau de 9h30 est valide côté client bien que 9h30+30min=10h00
-- dépasse 9h50) ; valider aussi la fin rejetterait des réservations
-- parfaitement légitimes.
--
-- Ancrée sur Europe/Paris (comme tout le reste du fichier — emails,
-- rappels) plutôt que sur le fuseau du serveur ou du navigateur : décision
-- volontairement alignée sur la limite déjà assumée de la génération de
-- créneaux côté client (voir mémoire "Ancrage timezone créneaux différé"),
-- pas une tentative de la résoudre entièrement ici. Un patient dont le
-- navigateur est réglé sur un autre fuseau au moment de réserver/reporter
-- (cas déjà rare, France uniquement) verrait dans ce cas précis son action
-- refusée avec un message générique plutôt que silencieusement acceptée à
-- la mauvaise heure — un compromis jugé préférable à ne rien valider du tout.
create or replace function public.validate_patient_appointment_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paris_start timestamp;
  v_dow int;
  v_ok boolean;
begin
  if (tg_op = 'INSERT' and auth.uid() = new.patient_id and not is_admin())
     or (tg_op = 'UPDATE' and auth.uid() = old.patient_id and not is_admin() and new.start_at is distinct from old.start_at)
  then
    v_paris_start := new.start_at at time zone 'Europe/Paris';
    v_dow := extract(dow from v_paris_start);

    select exists (
      select 1 from public.availabilities a
      where a.doctor_id = new.doctor_id
        and a.is_active
        and a.day_of_week = v_dow
        and v_paris_start::time >= a.start_time
        and v_paris_start::time < a.end_time
    ) into v_ok;

    if not v_ok then
      raise exception 'Ce créneau ne correspond à aucune disponibilité du praticien.';
    end if;

    if exists (
      select 1 from public.blocked_slots b
      where b.doctor_id = new.doctor_id
        and new.start_at < b.end_at
        and new.end_at > b.start_at
    ) then
      raise exception 'Ce créneau est indisponible (congé du praticien).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_validate_patient_slot on public.appointments;
create trigger appointments_validate_patient_slot
before insert or update on public.appointments
for each row execute function public.validate_patient_appointment_slot();

notify pgrst, 'reload schema';
