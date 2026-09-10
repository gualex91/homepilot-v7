# HomePilot V7 Cloud

Cette version utilise réellement Supabase pour :
- authentification courriel + mot de passe;
- foyers partagés;
- invitations de conjoint/copropriétaire;
- propriétés;
- tâches;
- équipements;
- journal d'activité;
- persistance cloud entre appareils.

## Test conjoint
1. Compte A : créer un foyer et une propriété.
2. Dans Foyer, inviter le courriel du compte B.
3. Compte B : créer un compte avec exactement ce courriel.
4. Après confirmation du courriel si demandée, se connecter.
5. Accepter l'invitation affichée sur l'accueil.
6. Les deux comptes doivent voir les mêmes propriétés et tâches.

Les invitations sont enregistrées dans le cloud mais aucun courriel d'invitation personnalisé n'est encore envoyé.

## Correctifs de stabilité — septembre 2026

L'entrée publique `index.html` contient le chargeur complet des modules. Le contenu de base est dans `app-core.html`. `seasonal-shell.html` reste un alias compatible, identique à `index.html`. Aucun rewrite de la racine n'est nécessaire : Vercel privilégie le fichier index existant.

- Les ajouts de dépenses, de propriétés et d'équipements réutilisent un identifiant de demande tant que la sauvegarde n'est pas confirmée. Après une erreur réseau, réessayer sans modifier le formulaire.
- Les équipements utilisent un seul parcours d'ajout. Les tâches déjà générées par la base sont conservées; une génération incomplète est signalée et peut être reprise.
- Les requêtes Budget passent par les routes HomePilot, avec le jeton de l'utilisateur et les règles RLS existantes. Les budgets restent personnels : aucun partage financier ni schéma de base n'a été modifié.
- Les sous-sections du Budget se rafraîchissent sur l'événement `hp-budget-loaded` plutôt qu'en remplaçant successivement sa fonction de chargement.
- Les échéances mensuelles sont bornées au dernier jour du mois; une échéance de fin de mois reste en fin de mois. Les dates des tâches générées côté serveur utilisent le calendrier UTC.
- L'accueil filtre les tâches terminées par identifiant avant de limiter la liste. Le classement cesse de modifier le DOM quand les données ne changent plus. Les noms et titres sont échappés lors du rendu HTML.

### Tests de régression

Avec Node.js 22 ou plus récent, sans dépendance pour les tests unitaires :

```sh
node --test tests/stability.test.mjs
```

Le scénario navigateur nécessite Playwright et Chromium installés dans l'environnement de test :

```sh
HP_BROWSER_TEST=1 node --test tests/stability.test.mjs
```

`HP_BROWSER_EXECUTABLE` peut désigner un Chromium déjà installé. Le scénario lance un serveur local temporaire, simule Supabase et vérifie l'accueil ainsi que le parcours d'ajout Budget jusqu'à la vue d'ensemble. Il ne crée aucune donnée réelle.

Ces tests ne remplacent pas une validation avec deux vrais comptes des invitations, rôles et règles RLS, ni un essai sur iPhone. Les doublons historiques éventuels ne sont pas supprimés automatiquement.

## Mes finances — budget guidé, version 1

L’onglet **Finances** commence maintenant par **Mon bilan**, **Mon plan** et **Échéances**. Les anciennes opérations, les objectifs d’épargne, les dettes et la valeur nette sont conservés sous le nouveau module.

- Revenus nets et charges datés : hebdomadaires, aux deux semaines, deux fois par mois, mensuels, trimestriels, annuels ou ponctuels. Une date connue ancre le calendrier; ce n’est pas une date de début. Aucune correction automatique pour les jours fériés.
- Enveloppes de dépenses courantes, en plus des charges régulières. Les anciennes cibles et les rappels peuvent être repris explicitement, puis vérifiés avant sauvegarde. Les prêts et hypothèques ne sont jamais ajoutés automatiquement.
- Provisions annuelles : moyenne annuelle et rattrapage d’ici l’échéance, en tenant compte du montant déjà réservé. Le rattrapage inclut le mois en cours. Les provisions ne créent pas de transactions.
- Prévu contre enregistré : comparaison du plan actuel avec les opérations du mois choisi, hors dates futures. Il ne s’agit pas d’un historique de versions mensuelles du plan ni d’une synchronisation bancaire. Un chargement partiel ne produit pas de faux total complet.
- Disponible estimé : solde déclaré aujourd’hui, hors épargne et provisions existantes, moins les paiements, dépenses courantes estimées et nouvelles provisions avant la prochaine rentrée positive. Les paiements du jour doivent être déjà déduits. Ceux à la date de paie sont déduits avant le versement. Une échéance annuelle dépassée suspend cette estimation.
- Accompagnement : résumé personnel à copier volontairement et fiche du conseiller. Aucun envoi, accès au budget, analyse des besoins d’assurance ou recommandation de placement n’est automatisé. L’indicateur de coussin décrit l’épargne déclarée divisée par les dépenses marquées essentielles.

### Données et sécurité

`budget-engine.js` contient les calculs partagés, en cents. `budget-planner.js` et sa feuille CSS pilotent l’interface. `/api/budget-plan` vérifie la session côté serveur et transmet le jeton de l’utilisateur à Supabase; aucun identifiant de propriétaire fourni par le navigateur n’est accepté.

Le schéma additionnel est documenté dans `db/budget-plans.sql`, appliqué par la migration distante `private_budget_plans_v1`. La table `budget_plans` comporte une ligne par utilisateur, quatre politiques RLS de propriétaire et aucun accès anonyme. Elle ne partage rien avec le foyer. Les révisions assurent la détection de conflits entre appareils et la reprise idempotente d’une sauvegarde incertaine. Les journaux techniques ne contiennent ni montants ni contenu du plan.

```sh
node --test tests/stability.test.mjs tests/budget-plan.test.mjs
```

Vérification initiale : 32 tests unitaires/API réussis; scénario navigateur non exécuté pour cette version. Les politiques de la nouvelle table ont été testées dans une transaction annulée : lecture/écriture du propriétaire autorisées, changement de propriétaire et lecture/écriture/suppression par une autre identité bloqués. Aucune donnée de test conservée. Une validation visuelle sur iPhone et un essai connecté de bout en bout restent à faire.

Les avertissements Supabase préexistants sur certaines fonctions `SECURITY DEFINER` et la protection contre les mots de passe compromis n’ont pas été modifiés par cette version. Ce module ne constitue pas une validation réglementaire de l’offre de services du conseiller.

## Capsule financière sur l’accueil

`financial-facts.js` ajoute une carte « Le savais-tu? » sous le message de bienvenue, même sans propriété ou budget configuré. Douze capsules couvrent le budget, l’épargne, les imprévus et les dettes; deux sont des exemples de calcul clairement identifiés, pas des statistiques de population. Les sources ACFC ont été consultées le 10 septembre 2026 et sont liées directement dans chaque carte.

Une nouvelle connexion ou un nouveau chargement de HomePilot avec une session existante tire la prochaine capsule d’une série mélangée. Les douze passent avant de recommencer, sans répéter la dernière au changement de série. Les événements de connexion répétés lors du retour dans un onglet, le renouvellement du jeton et la navigation interne ne changent pas le texte en cours de lecture.

L’ordre est une préférence locale du navigateur (`hp.home-financial-facts.v1`), sans identifiant de membre, jeton ni données financières. Il n’est pas synchronisé entre appareils. Si le stockage est indisponible, la rotation continue en mémoire; l’historique ne peut pas être conservé après fermeture. Aucun appel à la base ni génération automatique de conseil n’est ajouté. Les capsules documentaires sont retirées à leur date de révision (`reviewBy`, initialement le 10 mars 2027) tant que les sources n’ont pas été revérifiées; les exemples de calcul restent disponibles.

```sh
node --test tests/financial-facts.test.mjs tests/stability.test.mjs tests/budget-plan.test.mjs
```
