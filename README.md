# 🌿 PawCare — Guide de démarrage complet

## Ce que vous allez avoir
Une application de prise de rendez-vous médicaux complète avec :
- Recherche de praticiens par spécialité et ville
- Prise de RDV en 3 étapes
- Dashboard patient et médecin
- Messagerie en temps réel
- Notifications

---

## ÉTAPE 1 — Installer les outils (une seule fois)

### Sur Mac
1. Ouvrez le **Terminal** (cherchez "Terminal" dans Spotlight avec Cmd+Espace)
2. Installez Node.js : allez sur https://nodejs.org et cliquez sur le bouton vert "LTS"
3. Vérifiez : tapez `node --version` dans le Terminal → vous devez voir un numéro

### Sur Windows
1. Ouvrez le **PowerShell** (cherchez "PowerShell" dans le menu Démarrer)
2. Installez Node.js : allez sur https://nodejs.org et cliquez sur le bouton vert "LTS"
3. Redémarrez PowerShell après l'installation
4. Vérifiez : tapez `node --version` → vous devez voir un numéro

---

## ÉTAPE 2 — Créer votre projet Supabase (gratuit)

1. Allez sur **https://supabase.com** et créez un compte (bouton "Start for free")
2. Cliquez "New project"
3. Remplissez :
   - **Name** : pawcare
   - **Database Password** : choisissez un mot de passe fort et **notez-le**
   - **Region** : West EU (Ireland) — le plus proche de la France
4. Cliquez "Create new project" et attendez ~2 minutes

### Configurer la base de données
1. Dans Supabase, cliquez sur **SQL Editor** dans le menu gauche
2. Cliquez "New query"
3. Ouvrez le fichier `supabase/migrations/001_schema.sql` de ce projet
4. Copiez TOUT son contenu et collez-le dans l'éditeur Supabase
5. Cliquez le bouton **Run** (ou Ctrl+Entrée)
6. Vous devez voir "Success. No rows returned" → c'est bon !

### Récupérer vos clés API
1. Dans Supabase, allez dans **Settings** (icône engrenage en bas à gauche)
2. Cliquez **API**
3. Notez ces deux valeurs (vous en aurez besoin juste après) :
   - **Project URL** : quelque chose comme `https://abcdefgh.supabase.co`
   - **anon public** key : une longue chaîne commençant par `eyJ...`

### Désactiver la confirmation email (pour tester facilement)
1. Dans Supabase → **Authentication** → **Settings**
2. Décochez "Enable email confirmations"
3. Cliquez Save — vous pourrez vous inscrire sans avoir besoin de confirmer votre email

---

## ÉTAPE 3 — Configurer le projet sur votre ordinateur

### Télécharger le code
Si vous avez Git installé, dans votre Terminal/PowerShell :
```bash
git clone https://github.com/VOTRE-USERNAME/pawcare.git
cd pawcare
```

Sinon, téléchargez le ZIP depuis GitHub et décompressez-le.

### Créer le fichier de configuration
1. Dans le dossier du projet, **copiez** le fichier `.env.example` et **renommez la copie** en `.env.local`
2. Ouvrez `.env.local` avec un éditeur de texte (Bloc-notes sur Windows, TextEdit sur Mac)
3. Remplacez les valeurs par vos vraies clés Supabase :
```
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```
4. Sauvegardez le fichier

### Installer les dépendances
Dans le Terminal, dans le dossier du projet :
```bash
npm install
```
→ Attendez quelques minutes, c'est normal

---

## ÉTAPE 4 — Lancer l'application

```bash
npm run dev
```

Vous devriez voir :
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

**Sur votre ordinateur** : ouvrez http://localhost:3000 dans votre navigateur

**Sur votre téléphone** :
1. Votre téléphone doit être sur le même Wi-Fi que votre ordinateur
2. Utilisez l'adresse "Network" affichée (ex: http://192.168.1.42:3000)

---

## ÉTAPE 5 — Tester l'application

### Créer un compte patient
1. Cliquez "S'inscrire"
2. Choisissez "Patient"
3. Remplissez vos informations
4. Cliquez "Créer mon compte"
→ Vous êtes connecté !

### Créer un compte médecin
1. Ouvrez un onglet privé/incognito dans votre navigateur
2. Allez sur http://localhost:3000
3. Cliquez "S'inscrire"
4. Choisissez "Praticien"
5. Remplissez la spécialité, ex: "Médecine générale"

### Compléter le profil médecin (important pour apparaître dans la recherche)
Après vous être connecté en tant que médecin :
1. Allez dans Supabase → **Table Editor** → table `doctors`
2. Cliquez sur la ligne correspondant au médecin
3. Remplissez : `city`, `address`, `bio`, `consultation_price`
4. Cliquez Save

### Ajouter des disponibilités (pour que les créneaux apparaissent)
Dans Supabase → **Table Editor** → table `availabilities`, ajoutez une ligne :
- `doctor_id` : l'ID du médecin (copiez-le depuis la table `doctors`)
- `day_of_week` : 1 (= Lundi), 2 (= Mardi), etc.
- `start_time` : 09:00
- `end_time` : 17:00
- `slot_duration_minutes` : 30
- `is_active` : true

### Prendre un rendez-vous
1. Reconnectez-vous en tant que patient
2. Cliquez "Trouver un praticien"
3. Cherchez par spécialité ou ville
4. Cliquez sur un médecin → "Voir les disponibilités"
5. Choisissez un jour, un créneau, un motif
6. Confirmez !

---

## ÉTAPE 6 — Sauvegarder sur GitHub

```bash
git add .
git commit -m "PawCare - application complète"
git push origin main
```

---

## Commandes utiles

| Commande | Action |
|---|---|
| `npm run dev` | Lance l'app en local |
| `npm run build` | Compile pour la production |
| Ctrl+C | Arrête le serveur |

---

## En cas de problème

**"node n'est pas reconnu"** → Redémarrez votre Terminal après avoir installé Node.js

**Page blanche** → Vérifiez que `.env.local` existe et que les clés sont correctes

**"Cannot find module"** → Relancez `npm install`

**Aucun médecin dans la recherche** → Vérifiez que la table `doctors` a `city` rempli et que la table `availabilities` a au moins une ligne pour ce médecin

**Le téléphone ne peut pas accéder** → Vérifiez que le téléphone est sur le même Wi-Fi. Désactivez temporairement votre pare-feu Windows si besoin.
