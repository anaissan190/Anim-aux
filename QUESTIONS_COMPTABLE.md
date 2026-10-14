# Questions à poser au comptable — abonnements Animéaux

À envoyer par email avant d'ouvrir les abonnements. Les réponses décident des prix affichés, des factures et des textes légaux.

## Pièces jointes à envoyer avec cet email
1. **Extrait Kbis** (du 31/08/2026) : activité déclarée, SIRET, date de début d'activité.
2. **Exemple de facture générée par Stripe** (test du 14/10/2026) : pour montrer le format et les mentions actuelles.

## Le contexte à lui donner
Animéaux est une plateforme web de mise en relation entre propriétaires d'animaux et praticiens (vétérinaires, ostéopathes animaliers, comportementalistes…). Les propriétaires ne paient rien. Les praticiens paient un **abonnement mensuel**, par carte, via **Stripe** :
- individuel : **39,90 € HT / mois** ;
- cabinet (jusqu'à 5 praticiens) : **95,90 € HT / mois**.
Les clients sont des professionnels, en France surtout. Le paiement est prélevé chaque mois, à l'avance, et l'abonné peut résilier à tout moment (accès jusqu'à la fin de la période payée, pas de remboursement au prorata).

## Les 5 questions essentielles (à poser en premier)
1. **TVA : suis-je en franchise en base (art. 293 B du CGI) ou assujettie ?** Si assujettie, le taux est-il bien de 20 % sur ces abonnements ? (Les prix actuels sont affichés hors taxes : 39,90 € HT = 47,88 € TTC et 95,90 € HT = 115,08 € TTC à 20 %.)
2. **Si je suis en franchise : à partir de quel chiffre d'affaires je deviens redevable de la TVA, et que se passe-t-il en cours d'année si je dépasse le seuil ?** Dois-je alors facturer 20 % en plus de mes prix, ou absorber la TVA dans le prix ?
3. **Mon activité déclarée au Kbis couvre-t-elle la vente d'abonnements aux praticiens ?** Faut-il déposer une modification d'activité avant d'encaisser le premier abonnement ?
   - Statut : **entrepreneur individuel** (pas de société : ni objet social ni capital), immatriculée au **RCS de Bobigny le 29/07/2026**, **SIRET 107 512 907 00018**, nom commercial **Animéaux**, début d'activité le **01/08/2026**, exploitation directe, création.
   - **Code APE / NAF : 63.12Z — « Portails Internet »** (répertoire Sirene public).
   - **Activité déclarée, mot pour mot sur le Kbis :** « Édition et exploitation d'une plateforme numérique de mise en relation entre propriétaires d'animaux et praticiens du secteur animalier (vétérinaires, toiletteurs, comportementalistes, etc.), permettant la recherche de praticiens et la prise de rendez-vous en ligne. »
   - **Ce que je constate :** cette formulation décrit la mise en relation et la prise de rendez-vous, mais **ne mentionne pas la vente d'un abonnement** aux praticiens ni les outils inclus (agenda, réservation en ligne, messagerie avec les patients, dossiers des animaux, statistiques). Les propriétaires d'animaux ne paient rien ; seuls les praticiens paient.
   - **Ce que je voudrais savoir :**
     a. La formulation actuelle suffit-elle pour facturer un abonnement aux praticiens, ou faut-il la modifier (déclaration de modification au guichet unique) ?
     b. Si oui, est-ce à faire **avant** le premier encaissement, et la rédaction suivante convient-elle : « …, et commercialisation auprès des praticiens d'abonnements donnant accès à des services de gestion en ligne (agenda, réservation, messagerie, statistiques). » ?
     c. Le code APE 63.12Z reste-t-il le bon, ou en faut-il un autre ?
4. **Les factures générées par Stripe (envoyées automatiquement à chaque paiement) suffisent-elles, ou dois-je émettre mes propres factures ?** Quelles mentions obligatoires faut-il y faire figurer (SIRET, RCS, adresse, capital, numéro de TVA ou mention de franchise, numérotation) ?
   - **Exemple joint** (essai du 14/10/2026, numéro AEPSSOIX-0001) : on y voit la numérotation, la période facturée (14 oct.–14 nov.), la ligne « Abonnement Animéaux », le montant 39,90 € et le client facturé.
   - **Ce qui manque, à ce stade :** mon **SIRET / RCS**, mon **adresse**, la **mention de TVA** (franchise ou taux), le **statut d'entrepreneur individuel** ; l'en-tête indique encore « environnement de test » (normal en essai).
   - La facture affiche « **Montant dû** » et un lien « Payer en ligne » : une facture déjà réglée par carte doit-elle porter une mention « payée » / « acquittée » ? Dois-je régler ce point dans Stripe avant l'ouverture ?
5. **Comment comptabiliser les encaissements Stripe ?** Les virements arrivent nets des frais de Stripe : comment enregistrer le chiffre d'affaires brut, les frais et le virement ? Quel compte bancaire professionnel doit recevoir les virements ?

## Les points complémentaires
6. **Clients professionnels étrangers** (Belgique, Suisse, autres pays de l'UE) : TVA, autoliquidation, numéro de TVA intracommunautaire à demander ? Dois-je m'en occuper dès le départ ou refuser ces clients pour l'instant ?
7. **Praticiens eux-mêmes en franchise de TVA ou exonérés** : cela change-t-il ma facturation ?
8. **Impayés et remboursements** : si un praticien conteste un prélèvement ou si j'accorde un geste commercial, comment établir l'avoir ? La TVA est-elle récupérable sur une créance impayée ?
9. **Abonnement payé d'avance** : à quelle date reconnaître le chiffre d'affaires (mois encaissé ou mois consommé) ?
10. **Durée de conservation** des factures et données de paiement (obligations comptables), à mettre en regard de la suppression de compte à la demande de l'utilisateur.
11. **Déclarations** : y a-t-il une démarche à faire à l'ouverture de ce nouveau flux de revenus (déclaration d'activité, changement de régime, acomptes) ?
12. **Si le chiffre d'affaires devient significatif** : quel seuil devrais-je surveiller pour changer de régime (TVA, impôts, cotisations) ?

## Ce que je ferai selon sa réponse
- **Franchise en base** : afficher « TVA non applicable, art. 293 B du CGI » sur les factures ; prix identiques en HT et TTC ; les CGU disent déjà « TVA applicable le cas échéant ».
- **Assujettie à 20 %** : activer le calcul automatique de la TVA dans Stripe, ajouter la collecte du numéro de TVA des praticiens, mettre à jour les textes légaux.
