# Lancement d'Animéaux — liste à suivre

Ce qui reste à faire **en dehors du code** pour ouvrir l'application au public, puis un scénario de test complet.
À cocher au fur et à mesure. Dernière mise à jour : 14/10/2026.

## 1. Abonnements (les deux sont indispensables dès que de vrais utilisateurs arrivent)
- [ ] **Supabase → offre Pro** (~25 $/mois) : Organisation → Billing. Sans elle, le projet est **mis en pause après 7 jours sans activité** et il n'y a pas de sauvegardes automatiques. **Décidé le 28/10/2026 : à souscrire le plus tard possible, vers le 02-03/11/2026 (après versement du chômage), au plus tard avant le premier encaissement réel / l'ouverture au public.**
- [ ] **Vercel → offre Pro** (~20 $/mois) : l'offre gratuite (« Hobby ») interdit l'usage commercial. **Décidé le 28/10/2026 : à souscrire le plus tard possible, vers le 02-03/11/2026 (après versement du chômage), au plus tard avant le premier encaissement réel / l'ouverture au public.**
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
- Prix : individuel **39,90 €/mois** ; cabinet **95,90 €/mois**, jusqu'à 5 praticiens (secrétariats non comptés). **TVA NON APPLICABLE (franchise en base, micro-entreprise) — décidé le 15/10/2026** : les prix affichés sont ceux que le client paie, sans mention « HT ». Mention légale : « TVA non applicable, art. 293 B du CGI » (`VAT_NOTE`).
- [x] **TVA** : réponses de la belle-mère d'Anaïs reçues le 15/10/2026, franchise en base décidée (voir ci-dessous). Plus rien à envoyer à la comptable.
- [x] Cabinets (13/10/2026) : secrétariat réservé aux cabinets abonnés, messages clairs (cabinet non activé / complet), bandeau d'état dans l'espace praticien, page publique sans membres masqués, pastilles dans l'administration (migration 132).
- [x] **Étape 3** (13/10/2026) : espace du praticien en offre gratuite (onglets verrouillés par un cadenas, page d'explication, bandeau sur Mon espace). Le bouton « Passer à l'abonnement » ouvre un email pré-rempli vers l'équipe tant que Stripe n'est pas branché.
- [x] **Étape 4** : écran « Choisissez votre formule » à l'inscription praticien, livré le 26/10/2026 dans la phase de pré-lancement (voir 3 quater).
- [x] **Paiement Stripe, code livré le 13/10/2026** : écran `/abonnement`, paiement sécurisé, activation par la confirmation signée de Stripe, portail de gestion, garde-fous (suppression de compte, fermeture de cabinet). Migration 134 + fonctions `create-checkout-session`, `create-portal-session`, `stripe-webhook`.
- [x] **Stripe branché et testé en mode test le 14/10/2026** (compte, 2 produits, portail, webhook, 4 secrets) : paiement avec la carte de test, activation par le webhook, retour à l'offre gratuite par résiliation, visite guidée lancée à l'activation. Pièges rencontrés : identifiant de **produit** (`prod_…`) collé à la place de celui du **tarif** (`price_…`), et secret de signature du webhook (`whsec_…`) pas celui de la destination → 400 sur tous les envois.
- [ ] **Passer Stripe en mode réel** : recréer les 2 produits/tarifs, le portail et le webhook en mode réel, puis remplacer les 4 secrets Supabase (`sk_live_…`, `whsec_…`, 2 × `price_…`). Identifiants et coordonnées bancaires saisis par Anaïs, jamais par Claude.
- [ ] **Tester la suppression de compte avec un abonnement** (code livré le 29/10/2026, fonction Edge `delete-my-account` déployée) : compte praticien de test, abonnement avec la carte de test Stripe, « Supprimer mon compte » dans « Données et compte », puis contrôler dans Stripe (mode test) que l'abonnement est programmé pour se terminer. À faire AVANT de passer Stripe en réel.
- [ ] Restreindre les moyens de paiement de Stripe à la carte (Klarna, Satispay… proposés par défaut).
- [ ] Après le test : remettre Gary dans l'état voulu (annuler son abonnement test immédiatement dans Stripe → Abonnements, puis « Passer en abonnement » depuis l'administration) et décocher « Apparaître dans la recherche ».
- [x] **Plus de 5 praticiens (15/10/2026)** : offre « Grand cabinet » sur mesure, avec questionnaire de devis (`/devis-cabinet`), email de notification sur `contact.animeaux@gmail.com`, suivi dans l'administration et limite relevable cabinet par cabinet (migration 135 appliquée). Le devis est envoyé à la main.
- [x] **Prix du praticien supplémentaire au-delà de 5 : 19,90 € par mois** (décidé le 15/10/2026), utilisé dans les devis « grand cabinet » ; **pas publié** dans l'application (offre sur mesure) tant que la TVA et le paiement ne sont pas réglés. Un cabinet de 8 paierait 95,90 + 3 × 19,90 = 155,60 € HT.
- [ ] Décider d'un tarif annuel et d'un prix « fondateur » gelé.
- [x] **Lien de paiement d'un devis (15/10/2026)** : testé de bout en bout en mode test avec Gary (lien créé dans l'administration, page `/paiement-devis`, paiement, activation du cabinet avec sa limite de praticiens). Migration 136 appliquée.
- [x] **Statistiques de cabinet enrichies (15/10/2026)** : même contenu qu'un praticien seul, par praticien ou pour tout le cabinet, avec comparatif.
- [x] **Refonte visuelle des onglets Profil et Mon cabinet (15/10/2026)** : en-têtes de synthèse, sous-onglets, interrupteurs, un seul bouton Enregistrer en bas du profil. À regarder en vrai (téléphone et ordinateur) : jamais cliqué en réel.
- [x] **Refonte du profil patient (15/10/2026)** : même logique que le profil praticien (en-tête, 3 sous-onglets, un seul bouton Enregistrer en bas, notifications en interrupteur). À regarder en vrai sur téléphone (les patients y ont leur propre barre de navigation) et ordinateur.
- [ ] **Devis** : modèle à finaliser (dossier « Modèle de devis » sur le Bureau) et choisir comment le cabinet paie après acceptation (virement + facture et activation manuelle au début, ou abonnement Stripe sur mesure relié à son cabinet).
- [ ] **Vérifier les modèles d'emails de Supabase** (confirmation d'inscription, mot de passe oublié) : l'ancienne adresse `contact@monanimeaux.fr` n'est plus la bonne, remplacée partout dans l'application par `contact.animeaux@gmail.com`.
- [x] **Brouillon des CGU d'abonnement rédigé le 14/10/2026** (article 7 « Abonnement des praticiens » : prix tirés de la même source que l'écran, résiliation, défaut de paiement, pas de remboursement au prorata, pas de rétractation pour des professionnels ; Stripe ajouté aux sous-traitants de la politique de confidentialité). **À faire relire** avec le reste (section 4), puis préciser la TVA selon la réponse du comptable. Faire souscrire sur le **site web** seulement (règles Apple/Google pour l'appli mobile).
- **Réponses de la belle-mère d'Anaïs (comptable de proche), 15/10/2026 — à vérifier sur impots.gouv.fr / avec un professionnel :**
  - Activité du Kbis : **la phrase actuelle ne suffit pas, il faut la modifier** (guichet unique) **avant le premier encaissement réel**.
  - Factures : numérotation **continue sans trou** (1, 2, 3…), garder les preuves en cas de rupture ; mentionner le **numéro RCS et la ville du greffe (Bobigny)** ; conservation **10 ans** (à vérifier) ; remboursement = **avoir obligatoire**.
  - Compta : tenir à jour un **cahier de recettes / de dépenses** (montant total payé par le client + date d'encaissement) ; les factures Stripe justifient l'écart avec le virement net des frais.
  - Clients de l'UE : **numéro de TVA intracommunautaire** du client ET le sien sur la facture.
  - TVA : ses réponses se contredisaient ; **tranché le 15/10/2026 par Anaïs : pas de TVA pour l'instant** (franchise en base).
  - Seuils de franchise de TVA, prestations de services (résumé Google, sources impots.gouv, **non vérifié**) : **37 500 €** (tolérance **41 250 €**). Dépassement du seuil de base : TVA due à partir du 1er janvier suivant ; dépassement du seuil majoré : TVA due dès le dépassement.
- [x] **TVA : franchise en base (15/10/2026)** : « HT » retiré de l'application (pages d'offres, paiement d'un devis, administration, CGU) et remplacé par « TVA non applicable, art. 293 B du CGI ». À RECONSIDÉRER si le chiffre d'affaires approche **37 500 €** (services ; tolérance 41 250 €, à vérifier) : prévoir alors TVA à 20 % (prix à relire, Stripe Tax, CGU, devis, factures).
- [ ] **Suivre le chiffre d'affaires de l'année par rapport au seuil de la franchise** (aujourd'hui rien ne l'alerte) : à faire avec le cahier de recettes ; une alerte dans l'administration à ~30 000 € est possible.
- [ ] **Réglages de facturation de Stripe, au passage en réel** (Paramètres → Facturation → Factures) : pied de page « TVA non applicable, art. 293 B du CGI », SIRET 107 512 907 00018, RCS Bobigny, adresse ; ne jamais supprimer ni sauter un numéro de facture ; remboursement = avoir (Stripe « note de crédit »).
- [x] **Activité déclarée au Kbis** : modification signée le 28/10/2026 (formalité J00295818470) et **validée par le greffe de Bobigny le 29/10/2026**. Le nouvel extrait Kbis (à jour au 29/10/2026) mentionne bien la vente aux praticiens d'abonnements donnant accès à des services de gestion en ligne, à la suite de l'activité de mise en relation. **Plus rien ne bloque le premier encaissement réel côté Kbis.** Le Kbis contient date de naissance et domicile : à garder hors dépôt.
- [x] **Questions à la comptable** : déjà posées et répondues le 15/10/2026 (réponses résumées plus haut). `QUESTIONS_COMPTABLE.md` n'est plus à envoyer ; à ne rouvrir que si le chiffre d'affaires approche le seuil de la franchise.
- [x] Gary et Lina : abonnement fondateur, masqués de la recherche (interrupteur « Apparaître dans la recherche »).

## 3 quater. Pré-lancement praticiens (migration 137, 26/10/2026)

Avant d'ouvrir aux propriétaires, les praticiens créent un compte et indiquent la formule qui les intéresse, **sans paiement**. Toutes les dates annoncées sont **fictives** tant qu'elles ne sont pas décidées : rien n'est codé en dur, tout se règle dans Administration → Pré-lancement.

- [x] Migration `137_prelaunch.sql` appliquée en production le 28/10/2026 (vérifiée : note et messages d'erreur sans accents abîmés). Seul Gary figure dans `prelaunch_excluded` : le compte de Lina n'existe plus. Piège : copier le fichier avec `LC_ALL=en_US.UTF-8 pbcopy`, sinon les accents sont abîmés.
- Le site est **ouvert** par défaut (comportement actuel). Le basculer en pré-lancement se fait avec l'interrupteur « Ouverture au public » (confirmation demandée) ; le remettre sur ouvert ouvre l'accueil, la recherche, l'inscription propriétaire et les paiements.
- Date d'ouverture : vide = le site affiche « Ouverture bientôt ». Seuil de praticiens : visible de l'admin seul, sert à la jauge.
- Les comptes de démonstration (Gary, Lina) sont exclus du comptage via la table `prelaunch_excluded` ; pour en exclure un autre : `insert into public.prelaunch_excluded (user_id, note) values ('<id utilisateur>', 'test');`. L'inscription propriétaire est fermée dans l'interface pendant le pré-lancement.
- Pendant le pré-lancement, `create-checkout-session` et `create-quote-checkout` refusent tout paiement (code `prelaunch`).
- À faire plus tard : email d'invitation à l'ouverture et écriture groupée aux pré-inscrits ; liste d'attente des propriétaires.

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

## 8. Application native (App Store / Google Play, décidé le 29/10/2026)
- [x] **Compte Apple Developer payé le 29/10/2026** (99 €/an, type « Individual / Sole Proprietor », identifiant Apple propre à Animéaux, commande W1498536204, e-mail de confirmation reçu). Activation en attente (jusqu'à 48 h). Le nom légal d'Anaïs San Biagio sera le nom du vendeur sur l'App Store. Renouvellement automatique à vérifier dans le compte.
- [ ] Après activation : vérification d'identité si Apple la demande, puis créer l'identifiant `fr.monanimeaux.app` et la fiche de l'app dans App Store Connect.
- [ ] Déclarer le statut de « professionnel » (adresse, téléphone, e-mail publics sur l'App Store européen) : choisir quelle adresse afficher.
- [ ] Compte Google Play Console (≈ 25 $, une fois). Compte personnel : test fermé de 12 testeurs (adresse Gmail) pendant 14 jours avant la publication ; l'application Android doit exister avant (Android Studio à installer).
- [ ] Textes de fiche des deux stores, politique de confidentialité vérifiée, compte de test pour le relecteur Apple, captures d'écran des écrans définitifs.
- [ ] Notifications push natives (clés Apple APNs / Google Firebase) après ouverture des comptes.
- [ ] Charte graphique et pack community manager : dossier `Bureau/ANIMÉAUX/Pack community manager` (logo du site et icône en PNG transparent et SVG, charte importable dans Canva).

