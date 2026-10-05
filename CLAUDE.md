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

`supabase/functions/send-reminders/` (rappels RDV 24h, vaccin, avis) est appelée par un job `pg_cron` (`cron.job`, `select jobid, schedule, command from cron.job;`) via `net.http_post`, avec un secret custom (`CRON_SECRET`) en Authorization Bearer — **pas** un JWT Supabase, contrairement aux 4 autres Edge Functions déclenchées par trigger SQL (`send-appointment-cancellation`, `send-appointment-reschedule`, `send-push`, `send-waitlist-email`) qui utilisent `SUPABASE_SERVICE_ROLE_KEY`, un vrai JWT.

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
- **Migrations** : appliquées à la main dans le SQL Editor (001 → 125). La base de production a déjà divergé des fichiers : après toute migration d'accès, vérifier `pg_policies` (et ne jamais conclure qu'une règle manque ou existe d'après les seuls fichiers).
- **RLS** : une policy ne doit jamais relire sa propre table, même indirectement (récursion infinie) — passer par une fonction `security definer` (ex. `doctor_has_care_link`, `has_appointment_with_doctor`). Un delete/update refusé par RLS ne renvoie **aucune erreur**, juste 0 ligne : toujours `.select()` et contrôler le résultat.
- **Accès praticien au dossier d'un animal** : `doctor_has_care_link` (migration 116), miroir client `src/lib/careLink.ts`. Les policies `profiles` (coordonnées du propriétaire, nécessaires à l'agenda) n'en font volontairement pas partie.
- **Dates** : toujours via `src/lib/parisTime.ts` (Europe/Paris) ; jamais `getHours()`/`getDay()`/`getMonth()` natifs.
- **Deux pages profil** (`/profil` et onglet Profil de `DoctorDashboard.tsx`) sans code partagé : toute fonction de compte va aux deux.
- **Fonction pure = test** : toute logique extraite en fonction pure reçoit son test dans la foulée.
- **Visite guidée** : un nouveau bouton de navigation à expliquer = attribut `data-tour` + entrée dans `getTourSteps` (`src/lib/onboardingTour.ts`).
- **Emails d'authentification** : les modèles vivent dans le dashboard Supabase, pas dans le déploiement (`supabase/email-templates/` n'est qu'une référence).
- **Cache de l'application installée** : un `UpdateBanner` propose de recharger ; avant de conclure à un bug « invisible », vérifier la version affichée.
- **Connexion automatisée impossible** (Cloudflare Turnstile) : les parcours connectés se vérifient avec Anaïs ou par tests ; le dire clairement plutôt que de laisser croire à une vérification réelle.

### Bugs connus
- `npm audit` signale 2 vulnérabilités modérées dans `react-router` (désérialisation à l'hydratation SSR) : non exploitables ici, l'app est un SPA sans rendu serveur ; le correctif impose un saut de version majeure (7) à planifier à part.

### À continuer avec l'utilisatrice
- Modifications à définir sur l'appli (dashboard patient, recherche, page praticien...)
