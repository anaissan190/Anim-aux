# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev       # Démarre le serveur de dev sur http://localhost:3000
npm run build     # Vérification TypeScript + build production (tsc && vite build)
npm run preview   # Prévisualise le build de production en local
npm run lint      # ESLint sur tous les fichiers .ts/.tsx dans src/
```

Environnement : copier `.env.example` en `.env.local` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

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
- ✅ Lien dossier animal ↔ dashboard praticien (08/07/2026) : `appointments.animal_id` (nullable, choisi par le patient à la réservation) ; RLS ajoutée sur `animals`/`vaccines`/`weight_tracking`/`health_records`/`profiles` pour donner au praticien un accès lecture + ajout au dossier des animaux de ses patients dès que le RDV est `confirmed`/`completed` (voir `supabase/migrations/002_doctor_animal_access.sql`, **à exécuter manuellement dans Supabase → SQL Editor**) ; nouvel onglet "Mes patients" dans `DoctorDashboard` ; route `/animal/:id` désormais accessible aux patients ET aux praticiens (`ProtectedRoute` accepte un tableau de rôles) ; `AnimalHealthPage` adapte l'affichage selon le rôle (upload photo réservé au propriétaire, nom du praticien pré-rempli dans les formulaires vaccin/dossier) ; corrigé au passage : le nom du vétérinaire ne s'affichait jamais sur un vaccin (`v.veterinarian` au lieu de `v.administered_by`) et le nom du patient ne s'affichait pas sur les RDV côté praticien (mauvaise imbrication `users.profiles`)

### Bugs connus
- (aucun bug connu bloquant à ce jour)

### À continuer avec l'utilisatrice
- Modifications à définir sur l'appli (dashboard patient, recherche, page praticien...)
