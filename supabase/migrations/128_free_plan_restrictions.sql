-- ============================================================
-- ANIMÉAUX — Offre gratuite : réservation et messagerie fermées (11/10/2026)
-- ============================================================
-- ÉTAPE 2 des offres (voir 127). Un praticien en offre gratuite n'est qu'une
-- fiche visible : on ne peut plus lui réserver de rendez-vous, s'inscrire sur
-- sa liste d'attente ni lui écrire. Imposé côté base (policies RESTRICTIVES,
-- qui s'ajoutent en ET aux policies existantes sans les toucher — même
-- technique que 109 et 118), pas seulement par l'écran.
--
-- « Gratuit » = pas doctor_has_pro() : ni abonné, ni membre d'un cabinet
-- abonné. Aujourd'hui tous les praticiens existants sont en abonnement
-- fondateur (127), donc aucun comportement ne change tant qu'un praticien
-- n'est pas repassé en offre gratuite.
--
-- Ne touche que les NOUVELLES insertions : les rendez-vous déjà pris avec un
-- praticien repassé en gratuit restent valides, et ce praticien peut toujours
-- répondre à un message qu'il a reçu (le destinataire est alors un patient).
--
-- Retour arrière :
--   drop policy "appointments: praticien abonné requis" on public.appointments;
--   drop policy "messages: praticien abonné requis" on public.messages;
--   drop policy "waitlist: praticien abonné requis" on public.waitlist_entries;
-- ============================================================

-- Le destinataire est-il un praticien en offre gratuite ? SECURITY DEFINER :
-- ne dépend pas de ce que la RLS de `doctors` laisse voir à l'expéditeur (un
-- praticien masqué ou non vérifié serait sinon invisible, donc jugé « pas
-- gratuit »).
create or replace function public.is_free_plan_doctor_user(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.doctors d
    where d.user_id = p_user and not public.doctor_has_pro(d.id)
  );
$$;

grant execute on function public.is_free_plan_doctor_user(uuid) to authenticated;

-- Parmi une liste de praticiens, ceux qui ont toutes les fonctionnalités
-- (utilisé par la recherche : prochains créneaux uniquement pour ceux-là).
create or replace function public.get_pro_doctor_ids(p_ids uuid[])
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select i from unnest(p_ids) as i where public.doctor_has_pro(i);
$$;

grant execute on function public.get_pro_doctor_ids(uuid[]) to anon, authenticated;

drop policy if exists "appointments: praticien abonné requis" on public.appointments;
create policy "appointments: praticien abonné requis" on public.appointments
  as restrictive
  for insert
  with check (public.doctor_has_pro(doctor_id));

drop policy if exists "messages: praticien abonné requis" on public.messages;
create policy "messages: praticien abonné requis" on public.messages
  as restrictive
  for insert
  with check (is_admin() or not public.is_free_plan_doctor_user(receiver_id));

drop policy if exists "waitlist: praticien abonné requis" on public.waitlist_entries;
create policy "waitlist: praticien abonné requis" on public.waitlist_entries
  as restrictive
  for insert
  with check (public.doctor_has_pro(doctor_id));

notify pgrst, 'reload schema';
