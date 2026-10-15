# Lancement d'Animéaux — liste à suivre

Ce qui reste à faire **en dehors du code** pour ouvrir l'application au public, puis un scénario de test complet.
À cocher au fur et à mesure. Dernière mise à jour : 14/10/2026.

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
- [x] **Stripe branché et testé en mode test le 14/10/2026** (compte, 2 produits, portail, webhook, 4 secrets) : paiement avec la carte de test, activation par le webhook, retour à l'offre gratuite par résiliation, visite guidée lancée à l'activation. Pièges rencontrés : identifiant de **produit** (`prod_…`) collé à la place de celui du **tarif** (`price_…`), et secret de signature du webhook (`whsec_…`) pas celui de la destination → 400 sur tous les envois.
- [ ] **Passer Stripe en mode réel** : recréer les 2 produits/tarifs, le portail et le webhook en mode réel, puis remplacer les 4 secrets Supabase (`sk_live_…`, `whsec_…`, 2 × `price_…`). Identifiants et coordonnées bancaires saisis par Anaïs, jamais par Claude.
- [ ] Restreindre les moyens de paiement de Stripe à la carte (Klarna, Satispay… proposés par défaut).
- [ ] Après le test : remettre Gary dans l'état voulu (annuler son abonnement test immédiatement dans Stripe → Abonnements, puis « Passer en abonnement » depuis l'administration) et décocher « Apparaître dans la recherche ».
- [x] **Plus de 5 praticiens (15/10/2026)** : offre « Grand cabinet » sur mesure, avec questionnaire de devis (`/devis-cabinet`), email de notification sur `contact.animeaux@gmail.com`, suivi dans l'administration et limite relevable cabinet par cabinet (migration 135 appliquée). Le devis est envoyé à la main.
- [x] **Prix du praticien supplémentaire au-delà de 5 : 19,90 € HT par mois** (décidé le 15/10/2026), utilisé dans les devis « grand cabinet » ; **pas publié** dans l'application (offre sur mesure) tant que la TVA et le paiement ne sont pas réglés. Un cabinet de 8 paierait 95,90 + 3 × 19,90 = 155,60 € HT.
- [ ] Décider d'un tarif annuel et d'un prix « fondateur » gelé.
- [x] **Lien de paiement d'un devis (15/10/2026)** : testé de bout en bout en mode test avec Gary (lien créé dans l'administration, page `/paiement-devis`, paiement, activation du cabinet avec sa limite de praticiens). Migration 136 appliquée.
- [x] **Statistiques de cabinet enrichies (15/10/2026)** : même contenu qu'un praticien seul, par praticien ou pour tout le cabinet, avec comparatif.
- [x] **Refonte visuelle des onglets Profil et Mon cabinet (15/10/2026)** : en-têtes de synthèse, sous-onglets, interrupteurs, un seul bouton Enregistrer en bas du profil. À regarder en vrai (téléphone et ordinateur) : jamais cliqué en réel.
- [x] **Refonte du profil patient (15/10/2026)** : même logique que le profil praticien (en-tête, 3 sous-onglets, un seul bouton Enregistrer en bas, notifications en interrupteur). À regarder en vrai sur téléphone (les patients y ont leur propre barre de navigation) et ordinateur.
- [ ] **Devis** : modèle à finaliser (dossier « Modèle de devis » sur le Bureau) et choisir comment le cabinet paie après acceptation (virement + facture et activation manuelle au début, ou abonnement Stripe sur mesure relié à son cabinet).
- [ ] **Vérifier les modèles d'emails de Supabase** (confirmation d'inscription, mot de passe oublié) : l'ancienne adresse `contact@monanimeaux.fr` n'est plus la bonne, remplacée partout dans l'application par `contact.animeaux@gmail.com`.
- [x] **Brouillon des CGU d'abonnement rédigé le 14/10/2026** (article 7 « Abonnement des praticiens » : prix HT tirés de la même source que l'écran, résiliation, défaut de paiement, pas de remboursement au prorata, pas de rétractation pour des professionnels ; Stripe ajouté aux sous-traitants de la politique de confidentialité). **À faire relire** avec le reste (section 4), puis préciser la TVA selon la réponse du comptable. Faire souscrire sur le **site web** seulement (règles Apple/Google pour l'appli mobile).
- **Réponses de la belle-mère d'Anaïs (comptable de proche), 15/10/2026 — à vérifier sur impots.gouv.fr / avec un professionnel :**
  - Activité du Kbis : **la phrase actuelle ne suffit pas, il faut la modifier** (guichet unique) **avant le premier encaissement réel**.
  - Factures : numérotation **continue sans trou** (1, 2, 3…), garder les preuves en cas de rupture ; mentionner le **numéro RCS et la ville du greffe (Bobigny)** ; conservation **10 ans** (à vérifier) ; remboursement = **avoir obligatoire**.
  - Compta : tenir à jour un **cahier de recettes / de dépenses** (montant total payé par le client + date d'encaissement) ; les factures Stripe justifient l'écart avec le virement net des frais.
  - Clients de l'UE : **numéro de TVA intracommunautaire** du client ET le sien sur la facture.
  - TVA : **à clarifier** — elle indique « HT pour l'instant puis TTC » et « je facture dans tous les cas la TVA », ce qui est incompatible avec la franchise en base normalement applicable à une micro-entreprise sous le seuil (voir ci-dessous).
  - Seuils de franchise de TVA, prestations de services (résumé Google, sources impots.gouv, **non vérifié**) : **37 500 €** (tolérance **41 250 €**). Dépassement du seuil de base : TVA due à partir du 1er janvier suivant ; dépassement du seuil majoré : TVA due dès le dépassement.
- [ ] **Activité déclarée au Kbis** : elle décrit la mise en relation et la prise de rendez-vous, pas la vente d'abonnements aux praticiens. Voir avec la comptable s'il faut déposer une modification au guichet unique **avant le premier encaissement** (question 3 du fichier ci-dessous).
- [ ] **Envoyer les questions à la comptable** : `QUESTIONS_COMPTABLE.md`, avec le Kbis et l'exemple de facture Stripe (dossier « Questions comptable » sur le Bureau, hors dépôt car le Kbis contient des données personnelles) (franchise de TVA ou 20 %, factures Stripe, comptabilisation, clients étrangers…). Remplace la ligne « Confirmer la TVA » ci-dessus.
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
