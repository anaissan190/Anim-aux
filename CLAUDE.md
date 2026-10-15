# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev       # Démarre le serveur de dev sur http://localhost:3000
npm run build     # tsc + tests (vitest run) + build production — un test qui échoue bloque le déploiement
npm run preview   # Prévisualise le build de production en local
npm run lint      # tsc --noEmit avec détection des variables/imports inutilisés (ESLint n'est pas installé)
npm run test      # Lance les tests unitaires (Vitest) une fois
npm run test:watch # Idem, en mode watch
```

Environnement : créer `.env.local` (jamais committé) avec `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_VAPID_PUBLIC_KEY` (et `VITE_SENTRY_DSN`, facultatif) — voir README.md. Il n'y a pas de `.env.example`. Ne jamais y mettre la clé `service_role`.

## Architecture

**Animéaux** est une application de prise de rendez-vous vétérinaires (React 18 + Vite + TypeScript + Supabase).

### Auth & État global

- `src/lib/authStore.ts` — Store Zustand **persisté** (clé `pawcare-auth`) contenant `user` et `profile`. Le `persist` est indispensable pour survivre aux rafraîchissements de page. `loading` démarre à `false` car le persist restaure déjà la session.
- `src/App.tsx` — S'abonne à `supabase.auth.onAuthStateChange` et hydrate le store via le RPC `get_my_user_data()` (pas de requêtes directes sur `users`/`profiles` — elles causent des blocages RLS). Un timeout de 8s est en place pour ne jamais rester bloqué.
- `src/components/auth/ProtectedRoute.tsx` — Protège les routes par rôle. Affiche un écran "Chargement..." si `loading === true`. Les admins contournent les vérifications de rôle.
- La déconnexion vide l'état local **immédiatement** sans attendre Supabase (fire & forget) pour éviter les blocages.

### Couche données

Toutes les requêtes Supabase se trouvent dans `src/hooks/useData.ts` sous forme de hooks TanStack Query. Il n'y a pas de couche service séparée. Schéma général :
- Les queries sont identifiées par `[entité, id/filtres]`
- Les mutations appellent `qc.invalidateQueries` sur les clés liées après succès
- `useConversation` fait un polling toutes les 5 secondes

### Routing

La `<Navbar />` est gérée centralement dans le composant `Layout` de `App.tsx` — **ne pas** l'importer dans les pages individuelles. Elle est masquée sur `['/', '/login', '/register', '/forgot-password']`.

Trois dashboards par rôle derrière `ProtectedRoute` :
- `/dashboard/patient` — `PatientDashboard`
- `/dashboard/doctor` — `DoctorDashboard`
- `/dashboard/admin` — `AdminDashboard`

Public : `/`, `/search`, `/doctor/:id`, `/login`, `/register`, `/forgot-password`

### Base de données (Supabase)

Le schéma est dans `supabase/migrations/001_schema.sql`. 17 tables confirmées présentes en production (vérifié le 08/07/2026) : `animals`, `appointments`, `availabilities`, `blocked_slots`, `clinic_members`, `clinic_services`, `clinics`, `doctors`, `health_records`, `messages`, `notifications`, `profiles`, `reviews`, `specialties`, `users`, `vaccines`, `weight_tracking`.

**Fonctions RPC créées dans Supabase (SECURITY DEFINER — contournent le RLS) :**
- `get_my_user_data()` → retourne `{ role, profile }` pour l'utilisateur connecté. Utilisée à la connexion ET dans `onAuthStateChange`. **Ne jamais remplacer par des requêtes directes sur `users`/`profiles`.**
- `is_admin()` → vérifie si l'utilisateur connecté est admin
- `is_doctor(uid)` → vérifie si un uid est un praticien
- `get_my_doctor_id()` → retourne l'`id` du praticien connecté (depuis la table `doctors`)

**Jointures importantes :**
- `doctors.user_id` → `profiles` : `profiles!user_id(...)`
- `appointments.patient_id` → `profiles` : `profiles!patient_id(...)`

**Génération des créneaux** : côté client dans `useAvailableSlots` (itère par `slot_duration_minutes`).

### Problèmes RLS connus

Les requêtes directes sur `users` et `profiles` depuis le client **causent des timeouts** à cause de politiques RLS récursives. Toujours passer par le RPC `get_my_user_data()` pour récupérer le rôle et le profil de l'utilisateur connecté. Les fonctions `is_doctor()` et `get_my_doctor_id()` sont utilisées dans les politiques RLS pour éviter les sous-requêtes récursives.

### Edge Functions déclenchées par pg_cron

`supabase/functions/send-reminders/` (rappels RDV 24h, vaccin, avis) est appelée par un job `pg_cron` (`cron.job`, `select jobid, schedule, command from cron.job;`) via `net.http_post`, avec un secret custom (`CRON_SECRET`) en Authorization Bearer — **pas** un JWT Supabase. Les 4 autres Edge Functions déclenchées par trigger SQL (`send-appointment-cancellation`, `send-appointment-reschedule`, `send-push`, `send-waitlist-email`) s'authentifient avec un secret dédié, `PUSH_TRIGGER_SECRET` (migration 120, via `isAuthorizedTrigger`) : la clé `service_role` injectée dans les fonctions n'a pas le même format que celle du Vault et ne peut pas servir à ça.

Trois pièges découverts le 03/09/2026, tous invisibles dans `cron.job_run_details` (qui reste "healthy" quoi qu'il arrive — il ne reflète que l'exécution du SQL, jamais la réponse HTTP réelle) — **toujours diagnostiquer via `select * from net._http_response order by created desc limit 5;`** :
1. **Vérification JWT de la plateforme** : par défaut, Supabase exige un vrai JWT dans `Authorization`. Un secret custom comme `CRON_SECRET` échoue ce contrôle *avant* même d'atteindre le code de la fonction (401 `UNAUTHORIZED_INVALID_JWT_FORMAT`). Fix : Edge Functions → `send-reminders` → Settings → désactiver **"Verify JWT with legacy secret"**.
2. **Timeout de `net.http_post`** : défaut/hardcodé à 1000ms dans `cron.job.command`, trop court pour une fonction qui boucle sur plusieurs envois (Resend + SMS OVH). Fix : `select cron.alter_job(job_id := 1, command := $$ ... timeout_milliseconds:=30000 ... $$);`.
3. **`CRON_SECRET` désynchronisé** entre la valeur dans `cron.job.command` (en clair dans le SQL) et la valeur enregistrée dans Edge Functions → Secrets — les deux doivent être identiques mot pour mot.

Si un futur job cron+Edge Function silencieusement "ne fait rien", vérifier ces trois points dans l'ordre avant de chercher un bug côté code applicatif.

### Alias de chemin

`@/` pointe vers `src/` (configuré dans `vite.config.ts`). Toujours utiliser les imports `@/`, pas les chemins relatifs.

## État actuel & ce qui reste à faire

### Corrigé / Ajouté
- ✅ Connexion stable — ne déconnecte plus au refresh ni au TOKEN_REFRESHED
- ✅ `onAuthStateChange` ne refait les requêtes qu'au SIGNED_IN/SIGNED_OUT
- ✅ Session persistante au rafraîchissement (persist Zustand)
- ✅ Déconnexion fonctionnelle (fire & forget, vide le store immédiatement)
- ✅ Page d'inscription supporte les deux rôles (patient 🐾 / praticien 🩺)
- ✅ Dashboard praticien repensé : KPIs, demandes en attente fonctionnelles, bouton Terminer
- ✅ Navbar adaptée au rôle : "Trouver un praticien" masqué pour les praticiens, "Tableau de bord" pour les pros
- ✅ `DoctorDashboard` utilise désormais `currentDoctor.id` (corrigé)
- ✅ Page "Mon profil" (`/profil`) : modification prénom/nom/téléphone + infos pro (spécialité, bio, ville, tarif, adresse)
- ✅ Lien vers Mon profil en cliquant sur le prénom dans la navbar
- ✅ Hooks `useUpdateProfile` et `useUpdateDoctor` ajoutés dans `useData.ts`
- ✅ Vérifié en production (08/07/2026) : les 17 tables existent bien dans Supabase, y compris `animals`, `vaccines`, `weight_tracking`, `health_records`, `clinics`, `clinic_members`, `clinic_services`
- ✅ Lien dossier animal ↔ dashboard praticien (08/07/2026) : `appointments.animal_id` (nullable, choisi par le patient à la réservation) ; RLS ajoutée sur `animals`/`vaccines`/`weight_tracking`/`health_records`/`profiles` pour donner au praticien un accès lecture + ajout au dossier des animaux de ses patients (règle d'origine, **remplacée le 05/10/2026 par la règle « lien de soin » de la migration 116** : rendez-vous confirmé ou terminé de moins d'un an, voir ci-dessous) (voir `supabase/migrations/002_doctor_animal_access.sql`, **à exécuter manuellement dans Supabase → SQL Editor**) ; nouvel onglet "Mes patients" dans `DoctorDashboard` ; route `/animal/:id` désormais accessible aux patients ET aux praticiens (`ProtectedRoute` accepte un tableau de rôles) ; `AnimalHealthPage` adapte l'affichage selon le rôle (upload photo réservé au propriétaire, nom du praticien pré-rempli dans les formulaires vaccin/dossier) ; corrigé au passage : le nom du vétérinaire ne s'affichait jamais sur un vaccin (`v.veterinarian` au lieu de `v.administered_by`) et le nom du patient ne s'affichait pas sur les RDV côté praticien (mauvaise imbrication `users.profiles`)

### Conventions à retenir (acquises au fil des sessions)
- **Migrations** : appliquées à la main dans le SQL Editor (001 → 131). La base de production a déjà divergé des fichiers : après toute migration d'accès, vérifier `pg_policies` (et ne jamais conclure qu'une règle manque ou existe d'après les seuls fichiers).
- **RLS** : une policy ne doit jamais relire sa propre table, même indirectement (récursion infinie) — passer par une fonction `security definer` (ex. `doctor_has_care_link`, `has_appointment_with_doctor`). Un delete/update refusé par RLS ne renvoie **aucune erreur**, juste 0 ligne : toujours `.select()` et contrôler le résultat.
- **Accès praticien au dossier d'un animal** : `doctor_has_care_link` (migration 116), miroir client `src/lib/careLink.ts`. Les policies `profiles` (coordonnées du propriétaire, nécessaires à l'agenda) n'en font volontairement pas partie.
- **Dates** : toujours via `src/lib/parisTime.ts` (Europe/Paris) ; jamais `getHours()`/`getDay()`/`getMonth()` natifs.
- **Deux pages profil** (`/profil` et onglet Profil de `DoctorDashboard.tsx`) sans code partagé : toute fonction de compte va aux deux.
- **Fonction pure = test** : toute logique extraite en fonction pure reçoit son test dans la foulée.
- **Visite guidée** : un nouveau bouton de navigation à expliquer = attribut `data-tour` + entrée dans `getTourSteps` (`src/lib/onboardingTour.ts`).
- **Emails d'authentification** : les modèles vivent dans le dashboard Supabase, pas dans le déploiement (`supabase/email-templates/` n'est qu'une référence).
- **Cache de l'application installée** : un `UpdateBanner` propose de recharger ; avant de conclure à un bug « invisible », vérifier la version affichée.
- **Offres** (migrations 126 à 128) : `doctors.plan` (`free`|`pro`) et `clinics.plan` (`free`|`cabinet`, 5 praticiens max, limite en base) sont **verrouillés** par trigger (`prevent_self_plan_change`) : ni le praticien ni le propriétaire d'un cabinet ne peut se les attribuer ; seul un admin (`admin_set_doctor_plan` / `admin_set_clinic_plan`) ou le futur webhook de paiement (drapeau `app.internal_plan_update`). Un praticien a toutes les fonctionnalités s'il est abonné **ou** membre d'un cabinet abonné : `doctor_has_pro()`. Offre gratuite = fiche visible seulement : réservation, liste d'attente et messagerie (**dans les deux sens** : recevoir comme envoyer, migration 133) fermées par policies **restrictives** (`appointments`, `waitlist_entries`, `messages`), jamais seulement par l'écran ; onglets Patients, Tarifs, RDV, Statistiques et Messages verrouillés côté interface (`FREE_PLAN_LOCKED_TABS`). Miroir client : `src/lib/doctorPlan.ts` ; `useDoctorHasPro` / `useProDoctorIds` interrogent la base (source unique).
- **Paiement (Stripe)** : l'abonnement est piloté par Stripe, jamais par le navigateur. `create-checkout-session` (praticien vérifié seulement) → page Stripe → `stripe-webhook` (signature vérifiée, `supabase/functions/_shared/billing.ts`) → RPC `apply_subscription_state` (réservée à `service_role`, migration 134), SEULE voie qui passe `doctors.plan` / `clinics.plan` à l'offre payante ou la retire. Les offres « fondateur » (attribuées par l'admin) n'ont aucune ligne dans `subscriptions` et ne sont pas touchées. Un abonnement actif non résilié bloque `delete_my_account` et la suppression d'un cabinet. Les 4 secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_CABINET`) se posent dans Supabase par Anaïs, jamais dans le dépôt ni en conversation ; sans clés, l'écran répond « paiement pas encore ouvert ». Guide : `STRIPE.md`. Les prix affichés (`src/lib/subscription.ts`) doivent rester identiques aux prix créés dans Stripe.
- **Visibilité publique** : un praticien est visible s'il est vérifié **et** `is_listed` (interrupteur « Apparaître dans la recherche », migration 126) — `isPubliclyListed` dans `src/lib/doctorVisibility.ts`, même règle que la policy « doctors: lecture publique verifiee ».
- **Grand cabinet (plus de 5 praticiens, migration 135)** : pas de tarif publié, une 4e carte « Grand cabinet / Sur mesure » sur `/abonnement` mène au questionnaire `/devis-cabinet` (`CabinetQuotePage`). La fonction Edge `request-cabinet-quote` (praticien authentifié, validation `quote.ts` **partagée avec le formulaire** via `src/lib/cabinetQuote.ts`, 3 demandes/jour/compte) enregistre dans `quote_requests` (écrite UNIQUEMENT par `service_role`, lisible par l'auteur et l'admin) puis envoie un email à `contact.animeaux@gmail.com` (reply-to = le cabinet) et un accusé au praticien. L'admin suit les demandes (`AdminQuotesView`, statuts nouvelle → devis envoyé → acceptée/refusée) et envoie son devis **à la main** ; une fois accepté, il relève la limite du cabinet (`clinics.max_practitioners`, NULL = 5, verrouillée par trigger, RPC `admin_set_clinic_max_practitioners`) depuis la fiche du cabinet. `clinicSeatsLeft` / `clinicStatusText` prennent cette limite. Prix de référence d'un praticien supplémentaire (devis, non publié) : 19,90 € HT/mois. Adresse de contact unique : `CONTACT_EMAIL` (`doctorPlan.ts`), identique à la boîte de réception des devis (test).
- **Colonnes verrouillées par trigger** (`verification_status`, `is_verified`, `plan`, `average_rating`, `review_count`) : un `update` depuis le SQL Editor est **annulé en silence** (l'UPDATE annonce des lignes modifiées mais `returning` montre l'ancienne valeur) car `is_admin()` est faux sans utilisateur connecté. Passer par les RPC admin ou le drapeau local à la transaction (`app.internal_rating_update`, `app.internal_plan_update`) ; ne jamais désactiver le verrou.
- **Ordre de déploiement** : appliquer la migration en base **avant** de pousser le code qui lit la nouvelle colonne/fonction (sinon recherche ou espaces cassés), puis vérifier l'état réel (`pg_policies`, appel de la fonction avec la clé anon).
- **Signalements** : un avis ne peut être signalé que par le praticien concerné (`create_report`, migration 130/131) ; l'admin peut supprimer l'avis et clôturer en une action, et le praticien reçoit un email de retour (`send-report-feedback`, un envoi par signalement). La copie de l'avis est prise au signalement (`reports.target_snapshot`).
- **Fonctions Edge** : journaliser chaque échec (`console.error`) et faire remonter la raison à l'écran appelant — un « skipped » silencieux a déjà fait perdre une heure (12/10/2026). Logique pure (texte d'email…) dans un `.ts` sans import Deno, testé par Vitest (`supabase/functions/*/feedback.ts`).
- **Tests** : avant de créer un fichier de test, vérifier qu'il n'existe pas déjà (`ls`) — un `cat >` a écrasé `DoctorCard.test.tsx` le 12/10/2026 (restauré depuis git).
- **Clé `pawcare-auth`** (localStorage, `authStore.ts`) : nom historique **à ne pas renommer**, ce serait déconnecter tous les utilisateurs.
- **Connexion automatisée impossible** (Cloudflare Turnstile) : les parcours connectés se vérifient avec Anaïs ou par tests ; le dire clairement plutôt que de laisser croire à une vérification réelle.

### Bugs connus
- `npm audit --omit=dev` (ce qui est livré) signale 2 vulnérabilités modérées dans `react-router` (désérialisation à l'hydratation SSR) : non exploitables ici, l'app est un SPA sans rendu serveur ; le correctif impose un saut de version majeure (7) à planifier à part. Le `npm audit` complet en liste davantage (vite, tailwindcss, braces… : outils de build/dev, jamais livrés) ; les 2 critiques (`solid-js`, `seroval`) viennent de `@tanstack/react-query-devtools`, rangé en devDependencies depuis le 13/10/2026 et absent du build livré (vérifié : aucune trace dans `dist/`).

### À continuer avec l'utilisatrice
- Modifications à définir sur l'appli (dashboard patient, recherche, page praticien...)
