-- ============================================================
-- Encore la même famille de bug que 095/096, confirmé par Anaïs le
-- 22/09/2026 : la récursion "infinite recursion detected in policy for
-- relation doctors" persistait toujours après avoir retiré la clause
-- "collègue de cabinet" (096). Cause restante, présente depuis la 094 sans
-- avoir été touchée : la policy de lecture de `doctors` contient
-- `exists (select 1 from public.appointments a where ...)`, une lecture
-- directe (non protégée) de `appointments` — et `appointments` a sa propre
-- policy "médecin voit les siens" qui relit `doctors` :
--   auth.uid() = (select user_id from public.doctors where id = doctor_id)
-- Résultat : doctors -> appointments -> doctors, boucle entre les deux
-- tables (pas seulement une auto-référence directe comme 095/096).
--
-- Correctif : la même technique que get_my_clinic_ids() (040/041), qui
-- prouve déjà dans ce projet qu'une fonction security definer peut lire
-- une AUTRE table (clinic_members, doctors) sans redéclencher la policy
-- de la table appelante, tant que la fonction ne referme jamais le
-- chemin vers la table d'origine. Ici : isoler la lecture d'`appointments`
-- dans une fonction security definer dédiée, pour qu'elle ne passe plus
-- jamais par la policy RLS d'`appointments` (donc jamais par sa clause
-- "médecin voit les siens", donc jamais de retour vers `doctors`).
-- ============================================================

create or replace function public.has_appointment_with_doctor(target_doctor_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.appointments a
    where a.doctor_id = target_doctor_id and a.patient_id = auth.uid()
  );
$$;

grant execute on function public.has_appointment_with_doctor(uuid) to authenticated;

drop policy if exists "doctors: lecture publique verifiee" on public.doctors;
create policy "doctors: lecture publique verifiee" on public.doctors for select using (
  verification_status = 'verified'
  or auth.uid() = user_id
  or is_admin()
  or has_appointment_with_doctor(doctors.id)
);

notify pgrst, 'reload schema';
