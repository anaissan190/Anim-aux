# 🐾 Animéaux

Application web (installable, PWA) de prise de rendez-vous avec des praticiens du secteur animalier :
vétérinaires, ostéopathes, comportementalistes, toiletteurs, etc. Trois espaces : propriétaire d'animal,
praticien (avec cabinets et secrétariat) et administrateur.

Documentation fonctionnelle et technique complète : **`cahier_des_charges_animeaux.docx`** (tenu à jour à chaque évolution).
Consignes pour travailler dans le code : **`CLAUDE.md`**.

## Stack
React 18 · Vite · TypeScript · Tailwind · TanStack Query · Zustand · Supabase (Postgres + RLS, Auth, Storage, Edge Functions) ·
Resend (emails) · OVH (SMS) · Cloudflare Turnstile (anti-robot) · Sentry · Vercel (hébergement) · GitHub Actions.

## Démarrer en local
Prérequis : **Node 24 ou plus**.

```bash
npm install
```

Créez `.env.local` à la racine (ce fichier n'est jamais committé) :

```
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=...            # clé "anon / publishable", jamais la clé service_role
VITE_TURNSTILE_SITE_KEY=...           # CAPTCHA de connexion/inscription
VITE_VAPID_PUBLIC_KEY=...             # notifications push
VITE_SENTRY_DSN=...                   # facultatif en local
```

```bash
npm run dev       # http://localhost:3000
```

| Commande | Action |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires (Vitest) |
| `npm run lint` | Vérification TypeScript stricte (variables et imports inutilisés compris) |
| `npm run build` | Contrôle TypeScript, **tests**, puis build de production — un test qui échoue bloque le déploiement |
| `npm run preview` | Prévisualise le build |

## Base de données (Supabase)
Le schéma est dans `supabase/migrations/` (001 → 125), à appliquer **dans l'ordre**.
**Les migrations ne sont pas appliquées automatiquement** : on les colle dans le SQL Editor de Supabase.
La base de production a déjà divergé des fichiers par le passé (règles RLS présentes dans les fichiers mais absentes en base, et inversement) :
après toute migration touchant des règles d'accès, **vérifier l'état réel avec `pg_policies`** plutôt que de supposer qu'elle est passée.

## Déploiement
- **Site** : Vercel, à chaque push sur `main`. L'étape de build exécute les tests : un test qui échoue empêche la mise en ligne.
- **Fonctions Edge** (`supabase/functions/`) : déployées automatiquement par GitHub Actions
  (`.github/workflows/deploy-functions.yml`) quand elles changent sur `main`, après réussite des tests.
  Le réglage `verify_jwt` de chaque fonction est dans `supabase/config.toml` — ne jamais le laisser au dashboard,
  il se réinitialise à chaque redéploiement manuel.
- **Modèles d'emails d'authentification** (`supabase/email-templates/`) : à coller à la main dans
  Supabase → Authentication → Emails → Templates. Ils ne se déploient pas avec le code ; le fichier du dépôt n'en est que la référence.
- Après une mise en ligne, l'application installée affiche un bandeau « nouvelle version disponible » ; un clic sur Recharger suffit.

## Points d'attention
- **Fuseau horaire** : tout regroupement ou affichage de date passe par `src/lib/parisTime.ts` (Europe/Paris),
  jamais par `getHours()`/`getDay()` natifs — les tests tournent dans un autre fuseau et ont déjà révélé plusieurs bugs.
- **Deux pages profil séparées** : `/profil` (propriétaire, admin) et l'onglet Profil de `DoctorDashboard.tsx` (praticien)
  ne partagent aucun code ; toute fonctionnalité de compte doit être ajoutée aux deux.
- **Accès d'un praticien au dossier d'un animal** : rendez-vous maintenu (confirmé ou terminé) de moins d'un an —
  règle SQL `doctor_has_care_link` (migration 116), miroir client `src/lib/careLink.ts`.
- **Secrets** : jamais dans le dépôt. La clé `service_role` ne doit pas être mise dans `.env.local`.
