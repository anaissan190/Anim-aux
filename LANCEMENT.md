# Lancement d'Animéaux — liste à suivre

Ce qui reste à faire **en dehors du code** pour ouvrir l'application au public, puis un scénario de test complet.
À cocher au fur et à mesure. Dernière mise à jour : 06/10/2026.

## 1. Abonnements (les deux sont indispensables dès que de vrais utilisateurs arrivent)
- [ ] **Supabase → offre Pro** (~25 $/mois) : Organisation → Billing. Sans elle, le projet est **mis en pause après 7 jours sans activité** et il n'y a pas de sauvegardes automatiques.
- [ ] **Vercel → offre Pro** (~20 $/mois) : l'offre gratuite (« Hobby ») interdit l'usage commercial.
- [ ] Après le passage en Pro : Supabase → Database → **Backups** : vérifier qu'une sauvegarde quotidienne apparaît.

## 2. Réglages Supabase (Authentication)
Dans le menu de gauche : **Authentication**.
- [x] **Attack Protection → CAPTCHA protection** : activé (vérifié le 07/10/2026). — à l'origine : activer, fournisseur **Cloudflare Turnstile**, coller la **clé secrète** Turnstile (Cloudflare → Turnstile → ton site → « Secret key »). Sans cela, le captcha affiché dans l'application peut être contourné en appelant directement l'API.
- [x] **URL Configuration** (corrigée le 07/10/2026) : *Site URL* = `https://monanimeaux.fr` ; *Redirect URLs* = uniquement `https://monanimeaux.fr/**` (ajouter `http://localhost:3000/**` seulement si tu développes encore en local).
- [x] **Sign In / Providers → Email** : mot de passe minimum 8, confirmation d'email activée (07/10/2026).
- [ ] **Après avoir testé le bouton « Renvoyer l'email de confirmation »** : remettre *Email OTP expiration* à **3600** (1 h) pour faire disparaître l'alerte de Supabase.
- [ ] **Emails → Templates** : vérifier que « Confirm signup » et « Reset password » contiennent bien les modèles de `supabase/email-templates/`.

## 3. Surveillance
- [x] **Sentry** : règle par défaut « Send a notification for high priority issues » (email), vérifiée active le 06/10/2026 (déclenchée 18 h avant).
- [x] **UptimeRobot** (gratuit) : moniteur HTTP sur `monanimeaux.fr`, toutes les 5 minutes, alerte par email du compte (créé le 06/10/2026 ; vérifier qu'il passe à « Up »).

## 3 bis. Domaine (OVH)
- [ ] **Retrouver l'accès au compte OVH** (mot de passe oublié, mail de réinitialisation jamais reçu depuis la Malaisie le 06/10/2026). Indispensable : OVH gère le renouvellement du domaine `monanimeaux.fr` et le DNS. Vérifier la date d'expiration et l'activation du renouvellement automatique.
- [ ] **Faire marcher `www.monanimeaux.fr`** : dans la zone DNS OVH, remplacer l'enregistrement A de `www` (213.186.33.5) par un CNAME vers `cname.vercel-dns.com.`. Côté Vercel, c'est déjà fait (`www` redirige vers `monanimeaux.fr`, code 308). Ne pas toucher aux lignes MX/TXT/DKIM. Non urgent : le site fonctionne sans `www`.

## 4. Juridique
- [ ] Faire relire **CGU, politique de confidentialité et mentions légales** par un professionnel du droit (ou un service juridique en ligne).
- [ ] Vérifier les coordonnées des hébergeurs dans les mentions légales (Vercel, Supabase).
- [ ] Après relecture : demander le retrait du bandeau « en attente de relecture » (`src/pages/LegalPage.tsx`).
- [ ] Souscrire une assurance responsabilité civile professionnelle si ce n'est pas fait (à voir avec un conseiller).

## 5. Données de test
- [x] Comptes de test supprimés (reste 4 comptes : toi, l'admin, Gary, Lina).
- [ ] Les deux praticiens de démonstration (Gary, Lina) sont-ils visibles dans la recherche publique ? Si oui, les masquer avant l'ouverture, ou les supprimer.

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

## 7. Nettoyage automatique des fichiers
Une fonction (`purge-orphan-files`) supprime chaque dimanche les fichiers de stockage que plus rien ne référence. À activer une fois (voir la migration 125).
