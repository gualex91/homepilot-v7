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