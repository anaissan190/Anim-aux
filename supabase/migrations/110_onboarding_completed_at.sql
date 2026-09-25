-- 110_onboarding_completed_at.sql
-- Tuto de première connexion (visite guidée avec flèches) : mémorise le
-- moment où l'utilisateur l'a terminé ou fermé, pour ne l'afficher qu'une
-- seule fois par compte (et non par navigateur — un localStorage l'aurait
-- rejoué à chaque nouvel appareil).
--
-- Colonne sur `profiles` plutôt que sur `users` : `get_my_user_data` renvoie
-- déjà `to_json(p.*)` pour le profil (migration 063), donc la valeur arrive
-- toute seule dans le store d'authentification, et la policy d'update
-- propriétaire ("profiles: modifier le sien", migration 001) suffit — aucune
-- fonction ni policy à ajouter.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill : tous les comptes existants sont considérés comme "déjà
-- accueillis" — seuls les NOUVEAUX comptes voient le tuto. Évite de
-- l'imposer aux praticiens déjà actifs. (Pour le rejouer sur un compte de
-- test : update public.profiles set onboarding_completed_at = null where user_id = '...';)
update public.profiles
  set onboarding_completed_at = now()
  where onboarding_completed_at is null;
