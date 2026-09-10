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
