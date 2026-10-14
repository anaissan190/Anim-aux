# Questions à poser au comptable — abonnements Animéaux

À envoyer par email avant d'ouvrir les abonnements. Les réponses décident des prix affichés, des factures et des textes légaux.

## Le contexte à lui donner
Animéaux est une plateforme web de mise en relation entre propriétaires d'animaux et praticiens (vétérinaires, ostéopathes animaliers, comportementalistes…). Les propriétaires ne paient rien. Les praticiens paient un **abonnement mensuel**, par carte, via **Stripe** :
- individuel : **39,90 € HT / mois** ;
- cabinet (jusqu'à 5 praticiens) : **95,90 € HT / mois**.
Les clients sont des professionnels, en France surtout. Le paiement est prélevé chaque mois, à l'avance, et l'abonné peut résilier à tout moment (accès jusqu'à la fin de la période payée, pas de remboursement au prorata).

## Les 5 questions essentielles (à poser en premier)
1. **TVA : suis-je en franchise en base (art. 293 B du CGI) ou assujettie ?** Si assujettie, le taux est-il bien de 20 % sur ces abonnements ? (Les prix actuels sont affichés hors taxes : 39,90 € HT = 47,88 € TTC et 95,90 € HT = 115,08 € TTC à 20 %.)
2. **Si je suis en franchise : à partir de quel chiffre d'affaires je deviens redevable de la TVA, et que se passe-t-il en cours d'année si je dépasse le seuil ?** Dois-je alors facturer 20 % en plus de mes prix, ou absorber la TVA dans le prix ?
3. **Mon activité déclarée (code APE, objet social) couvre-t-elle la vente d'abonnements à un service en ligne ?** Faut-il modifier quelque chose à l'immatriculation (SIRET / RCS Bobigny) ?
4. **Les factures générées par Stripe (envoyées automatiquement à chaque paiement) suffisent-elles, ou dois-je émettre mes propres factures ?** Quelles mentions obligatoires faut-il y faire figurer (SIRET, RCS, adresse, capital, numéro de TVA ou mention de franchise, numérotation) ?
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
