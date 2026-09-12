# Nuvabri — validation du 12 septembre 2026

Périmètre : application personnelle, branche `preview/beta-20260910`, départ `ac2f6ea00652b5754402def37af9b41226bf050d`. Nuvabri Pro n’est pas concerné. Aucun lancement public ni abonnement payant activé.

## Décision

La revue technique disponible a été exécutée et deux défauts ont été corrigés. La validation de lancement reste ouverte : aucune restauration complète réussie, recette connectée sur appareils réels encore à terminer. Les réussites ci-dessous ne constituent pas un audit de sécurité exhaustif.

## Défauts corrigés

### Renouvellement d’une tâche récurrente

Une tâche sans équipement pouvait ne pas se renouveler si une autre propriété avait une tâche ouverte de même titre. Le contrôle des doublons ne filtrait pas la propriété. Reproduction en base réelle avec deux propriétaires temporaires : prochaine tâche absente.

La fonction de renouvellement filtre maintenant également `property_id`. Les données et échéances existantes n’ont pas été réécrites. Il ne s’agit pas d’une réparation rétroactive des occurrences éventuellement manquées; les tâches concernées peuvent être revues dans leur propriété.

- Source : `db/property-recurring-tasks.sql`.
- Migration appliquée : `20260912184711_scope_recurring_tasks_to_property`.
- Essai : `tests/property-recurring-tasks.sql`, réussi en répétition annulée puis après application. Plusieurs propriétés d’un même propriétaire et un autre propriétaire se renouvellent indépendamment. Refaire une complétion ne crée pas de doublon et un autre propriétaire ne peut pas compléter la tâche.

### Opérations financières après changement de session

Le chargeur pouvait afficher une réponse ancienne après déconnexion ou changement de compte. Un démarrage sans session tentait aussi de charger les opérations et inscrivait une erreur de session expirée dans la console.

Le chargeur ignore désormais les réponses périmées, invalide les demandes à la déconnexion, efface les chiffres et les champs de l’opération au changement de compte, et ne demande pas les données lorsqu’aucun utilisateur n’est connecté. Une actualisation ratée n’affiche plus d’anciens totaux comme actuels et conserve la saisie en cours.

Quatre tests reproduisent le démarrage déconnecté, la réponse après déconnexion, le changement de compte et les réponses inversées/échecs. Les enregistrements CELI/REER et les accès rapides revenu/dépense restent couverts.

## Résultats vérifiés

| Contrôle | Résultat | Limite |
|---|---|---|
| Suite JavaScript complète | 208 réussites, 0 échec | 1 test navigateur local non exécuté; réseau simulé dans les tests JS |
| Chiffrement des exports | 15 tests Python réussis | GPG réel; exports SQL simulés |
| Invitations et partage de propriétés | 44 assertions SQL réussies | Identités temporaires; pas de courriel envoyé |
| Paiements liés et suppression de biens | Suite SQL réussie | Paiement prévu retiré; opération déjà enregistrée conservée |
| Budget privé, opérations, loisirs | Suite SQL réussie | Lecture, modification, suppression et changement de propriétaire non autorisés refusés |
| Droits administrateur | Métadonnées utilisateur forgées sans effet dans l’essai | Contrôle ciblé, pas audit complet |
| Nettoyage des essais SQL | 0 compte temporaire restant | Transactions annulées |
| Tables applicatives | RLS activée sur les 31 tables publiques | Présence de RLS seule ne prouve pas toutes les permissions |
| Journaux serveur de préversion | Aucun 5xx dans le résultat sur les dernières 24 h | Relevé disponible, pas garantie d’absence d’incident |
| Accès Web au déploiement testé | Écran Nuvabri atteint avec lien de partage, sans connexion Vercel | Connexion Nuvabri requise pour la recette complète |

Commandes : `node --test tests/*.test.mjs` et `python3 tests/backup.test.py`.
Tests SQL : `tests/household-invitations.sql`, `tests/asset-payments-rls.sql`, `tests/private-data-rls.sql`, `tests/property-recurring-tasks.sql`. Tous utilisent des fixtures jetables et `ROLLBACK`; ne jamais remplacer par `COMMIT`.

## Sauvegarde : blocage confirmé

La sauvegarde planifiée du 12 septembre à 05:32 UTC échoue à l’export : `psql failed (exit 2) [AUTHENTICATION_FAILED]; no backup was published.` Les cinq exécutions les plus récentes consultées sont en échec. Aucun nouvel export, changement de mot de passe ou relancement inutile n’a été effectué par cette revue.

Une copie manuelle du 11 septembre existe, mais son manifeste la décrit comme une copie des données applicatives : elle exclut notamment les identités et sessions Auth, fichiers Storage et configuration Supabase. Sa restauration n’a pas été testée. Elle ne prouve pas la récupération complète du service.

Pour fermer ce point : corriger la connexion de sauvegarde dans le secret GitHub `SUPABASE_DB_URL` avec le véritable mot de passe PostgreSQL du projet, obtenir un export chiffré réussi, puis restaurer sur une cible isolée vide. Ne pas communiquer le mot de passe dans le chat. Le connecteur ne permet pas de lire le secret GitHub et aucun accès PostgreSQL valide ni cible de restauration locale compatible n’était disponible durant la revue. Aucun projet payant créé.

## Avis de sécurité à conserver au suivi

Le conseiller de sécurité Supabase a été interrogé avant et après la migration :

- 2 informations RLS sans politique sur les tables techniques d’import, fermées aux clients.
- 3 avis pour des fonctions privilégiées exécutables par le rôle anonyme et 10 pour le rôle connecté. Les fonctions examinées comprennent des déclencheurs et des contrôles de droits dépendant de `auth.uid()`; ces avis ne prouvent pas à eux seuls une fuite. La revue complète de leurs dépendances reste à faire avant de modifier leurs autorisations.
- Protection contre les mots de passe compromis signalée désactivée. Aucun changement de forfait effectué.

Références : [RLS et politiques](https://supabase.com/docs/guides/database/postgres/row-level-security), [fonction privilégiée accessible sans connexion](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [fonction privilégiée accessible après connexion](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [table protégée sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Recette restante sur téléphone

Utiliser un compte de test dédié, sans remplacer les montants d’un vrai utilisateur.

1. Se connecter, ajouter un revenu reçu de 1 000 $ et une dépense de 25 $ depuis les deux boutons du haut. Vérifier les opérations : revenus 1 000 $, dépenses 25 $, différence 975 $, si le compte ne contient aucune autre opération ce mois-ci.
2. Fermer puis rouvrir l’application : vérifier que les deux opérations restent présentes une seule fois.
3. Prévoir un revenu et des dépenses dans « Mes montants », enregistrer, puis vérifier le bilan et la conservation après reconnexion. Les opérations réelles ne créent pas automatiquement un revenu ou une facture récurrente dans le plan.
4. Ajouter une remorque de test et un paiement hebdomadaire, le modifier, puis supprimer cette fiche jetable. Vérifier son paiement prévu dans le budget et la conservation des opérations déjà payées.
5. Se déconnecter et utiliser un autre compte de test : aucun budget ou loisir privé du premier compte ne doit apparaître. Les propriétés volontairement partagées conservent leurs droits propres.
6. Tester la récupération du compte avec une boîte de test contrôlée, les erreurs réseau et le retour après suspension de l’application sur iPhone et Android.

L’accès permanent, les coordonnées de soutien, la politique officielle et la suppression complète du compte restent des étapes de préparation du lancement; cette revue ne les déclare pas terminées.
