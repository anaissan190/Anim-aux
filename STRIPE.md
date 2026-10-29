# Brancher le paiement des abonnements (Stripe)

Guide à suivre **une fois**, dans cet ordre. Tout se fait en **mode test** d'abord (aucun vrai argent), puis on refait les mêmes étapes en mode réel.
Ne jamais coller une clé Stripe dans une conversation, un fichier du projet ou un email : elles ne se posent que dans Supabase (étape 5).

## Ce que le code fait déjà
- L'écran **/abonnement** présente les offres (39,90 €/mois, cabinet 95,90 €/mois, **TVA non applicable** : franchise en base, décidé le 15/10/2026) et envoie vers la page de paiement sécurisée de Stripe.
- Au retour, l'offre n'est activée **que par la confirmation signée de Stripe** (fonction `stripe-webhook`), jamais par la simple redirection du navigateur.
- Le praticien gère carte, factures et résiliation sur le **portail client Stripe** (bouton « Gérer mon abonnement »).
- Personne ne paie avant la **validation de son dossier** par l'admin.
- Fermer un cabinet abonné reste bloqué tant que l'abonnement n'est pas résilié. Supprimer SON COMPTE, en revanche, passe par la fonction Edge `delete-my-account` : elle programme d'abord la fin de l'abonnement chez Stripe (pas de nouveau prélèvement, période payée non remboursée), puis supprime le compte. C'est ce qui permet la suppression depuis l'application native, sans écran de résiliation. À déployer comme les autres fonctions (JWT désactivé dans `config.toml`).

## 1. Créer le compte Stripe
1. Va sur **stripe.com** et crée un compte (email + mot de passe de ton choix).
2. Reste en **mode test** (interrupteur « Mode test » en haut à droite du tableau de bord).
3. Pour passer en réel plus tard, Stripe te demandera les informations de ton entreprise (SIRET, adresse), une pièce d'identité et ton **IBAN** pour recevoir les paiements. C'est toi qui les saisis, directement chez Stripe.

## 2. Créer les deux produits (Catalogue de produits → Ajouter un produit)
| Produit | Prix | Facturation | Taxe |
|---|---|---|---|
| Abonnement Animéaux | 39,90 € | Récurrent, **mensuel** | **Hors taxe** (« exclusive ») |
| Abonnement cabinet Animéaux | 95,90 € | Récurrent, **mensuel** | **Hors taxe** (« exclusive ») |

Après création, ouvre chaque produit et **copie l'identifiant du prix** (il commence par `price_`). Il t'en faut deux.

## 3. Configurer le portail client (Paramètres → Facturation → Portail client)
- Activer : **mettre à jour le moyen de paiement**, **voir l'historique des factures**, **résilier l'abonnement** (résiliation **à la fin de la période**).
- Renseigner les liens vers les conditions générales (`https://monanimeaux.fr/cgu`) et la politique de confidentialité (`https://monanimeaux.fr/confidentialite`).

## 4. Créer le point de réception des événements (Développeurs → Webhooks → Ajouter un endpoint)
- **URL** : `https://agjuakrtqfddkfoocbof.supabase.co/functions/v1/stripe-webhook`
- **Événements** à cocher : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- Après création, copie le **secret de signature** (il commence par `whsec_`).

## 5. Poser les clés dans Supabase (toi seule, dans le navigateur)
Supabase → **Edge Functions → Secrets** → ajouter ces secrets :

| Nom | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | la clé secrète de test (`sk_test_…`, Développeurs → Clés API) |
| `STRIPE_WEBHOOK_SECRET` | le secret de signature de l'étape 4 (`whsec_…`) |
| `STRIPE_PRICE_PRO` | l'identifiant du prix « Abonnement Animéaux » (`price_…`) |
| `STRIPE_PRICE_CABINET` | l'identifiant du prix « Abonnement cabinet Animéaux » (`price_…`) |

Facultatif, **seulement une fois la TVA confirmée avec le comptable et Stripe Tax configuré** : `STRIPE_AUTOMATIC_TAX` = `true`.
Les fonctions lisent ces secrets à chaque appel : pas besoin de redéployer.

## 6. Tester en mode test
Carte de test acceptée : **4242 4242 4242 4242**, date future quelconque, CVC quelconque.
1. Avec un compte praticien **vérifié** en offre gratuite : Mon espace → « Passer à l'abonnement » → cocher les conditions → « Choisir l'abonnement » → payer avec la carte de test.
2. Tu reviens sur `/abonnement?paiement=succes` : le message « Paiement reçu… » puis « votre abonnement est actif » doit apparaître en quelques secondes, et les onglets se déverrouillent.
3. « Gérer mon abonnement » ouvre le portail ; résilie : la page affiche « Résilié : l'abonnement reste actif jusqu'au… ».
4. Paiement qui échoue : carte **4000 0000 0000 9995** (fonds insuffisants).
5. Dans Stripe → Développeurs → Webhooks, chaque événement doit apparaître en **réussi** (200).

## 7. Passer en réel
Quand tout est bon en test et que la TVA est confirmée : désactiver le mode test dans Stripe, refaire les étapes 2 à 5 avec les **clés réelles** (nouveaux produits, nouveau endpoint avec son propre `whsec_`, nouveaux identifiants de prix), et remplacer les 4 secrets de Supabase. Refaire un achat réel de test avec ta propre carte, puis te le faire rembourser depuis Stripe.

## En cas de problème
- « Le paiement en ligne n'est pas encore ouvert » : un des 4 secrets manque ou est mal recopié.
- Paiement réussi mais l'offre ne s'active pas : Stripe → Webhooks → regarder la réponse du dernier événement ; Supabase → Edge Functions → `stripe-webhook` → Logs.
- Ne jamais activer une offre à la main pour contourner : passer par l'administration (offre « fondateur ») seulement pour un cadeau voulu.
- « Le service de paiement n'a pas répondu » : Stripe a refusé la demande. Stripe → Développeurs → Workbench → Aperçu → section **Santé** (ou onglet Logs) donne la raison exacte. Cas vécu le 14/10/2026 : `resource_missing - line_items[*][price]` = l'identifiant collé dans `STRIPE_PRICE_PRO`/`STRIPE_PRICE_CABINET` était celui du **produit** (`prod_…`) au lieu de celui du **tarif** (`price_…`, à copier sur la ligne du tarif, pas dans « Détails » du produit).
- Webhook en **400** dans Stripe (Workbench → Webhooks → la destination → Événements envoyés) : le secret de signature `STRIPE_WEBHOOK_SECRET` n'est pas celui de cette destination (à copier dans l'onglet **Aperçu** de la destination, « Secret de signature », `whsec_…`). Après correction, « Renvoyer » l'événement : l'offre s'active sans repayer. Les secrets sont lus sans les espaces autour.
- Ne pas recliquer sur « Choisir l'abonnement » pendant que l'activation est en attente : l'application ne sait pas encore que le paiement existe et en ouvrirait un second.
- Les journaux de fonctions Supabase peuvent rester vides pendant un incident Supabase : le Workbench de Stripe garde de toute façon la trace de chaque requête et de chaque envoi webhook.

## Facturation (à régler au passage en réel)
- **Franchise en base de TVA** : dans Stripe → Paramètres → Facturation → Factures, mettre dans le **pied de page** « TVA non applicable, art. 293 B du CGI », ainsi que le SIRET 107 512 907 00018 et « RCS Bobigny ». Ne pas activer Stripe Tax (`STRIPE_AUTOMATIC_TAX` reste absent).
- **Numérotation** : continue, sans trou ; ne jamais supprimer une facture réelle. Un remboursement passe par une **note de crédit** (avoir), jamais par une suppression.
- **Conservation** : 10 ans (à vérifier avec le comptable). Les factures de test (mode test) n'ont aucune valeur comptable.
- **Si le seuil de franchise est dépassé** : TVA à 20 % à appliquer, Stripe Tax à configurer et `STRIPE_AUTOMATIC_TAX=true` ; prix, CGU, devis à revoir (voir LANCEMENT.md).
