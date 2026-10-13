# Lancement d'Animéaux — liste à suivre

Ce qui reste à faire **en dehors du code** pour ouvrir l'application au public, puis un scénario de test complet.
À cocher au fur et à mesure. Dernière mise à jour : 13/10/2026.

## 1. Abonnements (les deux sont indispensables dès que de vrais utilisateurs arrivent)
- [ ] **Supabase → offre Pro** (~25 $/mois) : Organisation → Billing. Sans elle, le projet est **mis en pause après 7 jours sans activité** et il n'y a pas de sauvegardes automatiques.
- [ ] **Vercel → offre Pro** (~20 $/mois) : l'offre gratuite (« Hobby ») interdit l'usage commercial.
- [ ] Après le passage en Pro : Supabase → Database → **Backups** : vérifier qu'une sauvegarde quotidienne apparaît.

## 2. Réglages Supabase (Authentication)
Dans le menu de gauche : **Authentication**.
- [x] **Attack Protection → CAPTCHA protection** : activé (vérifié le 07/10/2026). — à l'origine : activer, fournisseur **Cloudflare Turnstile**, coller la **clé secrète** Turnstile (Cloudflare → Turnstile → ton site → « Secret key »). Sans cela, le captcha affiché dans l'application peut être contourné en appelant directement l'API.
- [x] **URL Configuration** (corrigée le 07/10/2026) : *Site URL* = `https://monanimeaux.fr` ; *Redirect URLs* = uniquement `https://monanimeaux.fr/**` (ajouter `http://localhost:3000/**` seulement si tu développes encore en local).
- [x] **Sign In / Providers → Email** : mot de passe minimum 8, confirmation d'email activée (07/10/2026).
- [x] Bouton « Renvoyer l'email de confirmation » testé en vrai le 06/10/2026 (fonctionne).
- [x] *Email OTP expiration* remis à **3600** (1 h) le 06/10/2026.
- [ ] **Emails → Templates** : vérifier que « Confirm signup » et « Reset password » contiennent bien les modèles de `supabase/email-templates/`.

## 3. Surveillance
- [x] **Sentry** : règle par défaut « Send a notification for high priority issues » (email), vérifiée active le 06/10/2026 (déclenchée 18 h avant).
- [x] **UptimeRobot** (gratuit) : moniteur HTTP sur `monanimeaux.fr`, toutes les 5 minutes, alerte par email du compte (créé le 06/10/2026 ; vérifier qu'il passe à « Up »).

## 3 bis. Domaine (OVH)
- [x] **Accès au compte OVH retrouvé** le 06/10/2026. Domaine `monanimeaux.fr` : renouvellement annuel automatique, expire le **20/07/2027** (vérifié le 06/10/2026) ; garder un moyen de paiement valide chez OVH. Indispensable : OVH gère le renouvellement du domaine `monanimeaux.fr` et le DNS. Vérifier la date d'expiration et l'activation du renouvellement automatique.
- [x] **`www.monanimeaux.fr`** : CNAME vers `cname.vercel-dns.com.` créé chez OVH (en remplacement du A et du TXT `3|welcome`), `www` redirige en 308 vers `monanimeaux.fr` (vérifié le 06/10/2026).

## 3 ter. Offres et paiement (décidé le 11-12/10/2026)
- Prix : individuel **39,90 € HT/mois** ; cabinet **95,90 € HT/mois**, jusqu'à 5 praticiens (secrétariats non comptés). Affichage en **HT**.
- [ ] **Confirmer la TVA avec le comptable** (franchise en base ou TVA à 20 %) avant de publier un prix.
- [x] Cabinets (13/10/2026) : secrétariat réservé aux cabinets abonnés, messages clairs (cabinet non activé / complet), bandeau d'état dans l'espace praticien, page publique sans membres masqués, pastilles dans l'administration (migration 132).
- [x] **Étape 3** (13/10/2026) : espace du praticien en offre gratuite (onglets verrouillés par un cadenas, page d'explication, bandeau sur Mon espace). Le bouton « Passer à l'abonnement » ouvre un email pré-rempli vers l'équipe tant que Stripe n'est pas branché.
- [ ] **Étape 4** : écran « Choisissez votre formule » à l'inscription praticien (maquette validée le 11/10).
- [x] **Paiement Stripe, code livré le 13/10/2026** : écran `/abonnement`, paiement sécurisé, activation par la confirmation signée de Stripe, portail de gestion, garde-fous (suppression de compte, fermeture de cabinet). Migration 134 + fonctions `create-checkout-session`, `create-portal-session`, `stripe-webhook`.
- [ ] **Brancher Stripe** en suivant `STRIPE.md` (compte, 2 produits, portail, webhook, 4 secrets dans Supabase), tester en mode test, puis passer en réel. Identifiants et coordonnées bancaires saisis par Anaïs, jamais par Claude.
- [ ] Décider du supplément au-delà de 5 praticiens, d'un tarif annuel et d'un prix « fondateur » gelé.
- [ ] **Mettre à jour les CGU / ajouter des conditions de vente** (abonnement, TVA, résiliation, droit de rétractation) et les faire relire avec le reste (section 4). Faire souscrire sur le **site web** seulement (règles Apple/Google pour l'appli mobile).
- [x] Gary et Lina : abonnement fondateur, masqués de la recherche (interrupteur « Apparaître dans la recherche »).

## 4. Juridique
- [ ] Faire relire **CGU, politique de confidentialité et mentions légales** par un professionnel du droit (ou un service juridique en ligne).
- [ ] Vérifier les coordonnées des hébergeurs dans les mentions légales (Vercel, Supabase).
- [ ] Après relecture : demander le retrait du bandeau « en attente de relecture » (`src/pages/LegalPage.tsx`).
- [ ] Souscrire une assurance responsabilité civile professionnelle si ce n'est pas fait (à voir avec un conseiller).

## 5. Données de test
- [x] Comptes de test supprimés (reste 4 comptes : toi, l'admin, Gary, Lina).
- [ ] Masquer les deux praticiens de démonstration (Gary, Lina) de la recherche publique : décidé le 11/10/2026, via l'interrupteur « Apparaître dans la recherche » (migration 126, puis `update doctors set is_listed = false` sur les deux). Un retour à « pending » est impossible depuis le SQL Editor (verrou `prevent_self_verification`).

## 6. Scénario de test complet (avec des comptes tout neufs)
À faire sur téléphone **et** sur ordinateur. Utiliser de **vraies** adresses (`toi+essai1@gmail.com`, jamais une adresse inventée).

**Propriétaire**
1. Inscription → email de confirmation reçu (vérifier les spams).
   **Test du bouton de renvoi :** *ne pas cliquer* sur ce premier lien, essayer de se connecter → le bouton « Renvoyer l'email de confirmation » doit apparaître (valider d'abord la vérification anti-robot) → le second email arrive. Seulement après, cliquer sur le lien → connexion.
   *Une fois ce test réussi :* remettre dans Supabase « Email OTP expiration » à **3600** (1 h).
2. La visite guidée s'affiche une seule fois.
3. Ajouter un animal avec photo ; changer la photo (l'ancienne ne doit plus apparaître).
4. Réserver un rendez-vous chez un praticien de test, avec un document joint.
5. Ouvrir le document (Documents) : il s'ouvre.
6. Écrire un message au praticien.
7. Annuler le rendez-vous.
8. Profil → « Télécharger mes données » : un fichier se télécharge.

**Praticien**
1. Inscription → dépôt d'un document justificatif → validation par l'admin → première arrivée sur le tableau de bord (visite guidée).
2. Notification « Nouveau rendez-vous » reçue (application + téléphone) à la réservation du propriétaire.
3. Voir l'animal dans « Mes patients », ajouter un suivi, un poids.
4. Annuler le rendez-vous côté praticien → le propriétaire reçoit notification **et** email.
5. Onglet Statistiques et export comptable.
6. Créer un cabinet, le fermer.

**Suppression de compte** : Profil → zone dangereuse → supprimer. Vérifier ensuite dans Supabase qu'il ne reste plus rien (compte, animaux).

## 6 bis. Résultats du test du 06/10/2026 (vraiment fait, comptes `+essai1/2/3`)
- [x] Inscription propriétaire, email de confirmation (arrive en 3-4 min chez Gmail : retard côté Gmail, SPF/DKIM/DMARC tous PASS, envoi en 1 s), visite guidée.
- [x] Animal + photo, rendez-vous avec document joint, ouverture du document (défaut de « lien cliqué trop tôt » corrigé), messagerie dans les deux sens, annulation par le patient + perte d'accès du praticien, téléchargement des données.
- [x] Inscription praticien, dépôt de plusieurs justificatifs, validation admin, visite guidée (corrigée : ne se lance qu'une fois vérifié).
- [x] Suppression d'un compte praticien : 0 ligne orpheline (profils, animaux, rendez-vous).
- [x] Suppression d'un compte propriétaire avec animal, rendez-vous, document et messages : 0 ligne orpheline (vérifié le 06/10/2026 après suppression de `+essai1` et `+essai3`).
- [ ] Non testé en vrai : suivi/poids côté praticien, annulation côté praticien (email au propriétaire), statistiques et export comptable, création/fermeture de cabinet.
- [x] Comptes `+essai1`, `+essai2`, `+essai3` supprimés.

## 7. Nettoyage automatique des fichiers
Une fonction (`purge-orphan-files`) supprime chaque dimanche les fichiers de stockage que plus rien ne référence. À activer une fois (voir la migration 125).
