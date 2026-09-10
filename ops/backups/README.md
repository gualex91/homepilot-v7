# Nuvabri — sauvegarde sans abonnement Supabase Pro

**État : préparée, pas encore active.** Aucun export réel ni aucune restauration
de la base n'ont été effectués. Le forfait gratuit a été confirmé par la capture
du propriétaire. Aucun changement de forfait n'est autorisé.

Le programme utilise les exports officiels Supabase, les chiffre avec GnuPG,
redéchiffre l'archive et vérifie les empreintes de chaque fichier avant de
déclarer l'export réussi. Ce contrôle ne remplace pas un essai de restauration
dans PostgreSQL.

## Ce qui est prêt

- `backup.py export` : exports des rôles, du schéma applicatif, des données
  (dont les comptes Auth), de l'historique des migrations et des personnalisations
  applicatives sur les schémas Auth/Storage.
- Vérification de la présence de chaque table applicative attendue et d'`auth.users`.
- Archive GPG AES-256 avec secret propre aux sauvegardes, intégrité des fichiers,
  contrôle du déchiffrement et suppression des fichiers temporaires.
- `backup.py unpack` : déchiffrement et extraction contrôlée; aucune connexion
  ni modification de base de données.
- `github-backup.yml` : modèle destiné à un **dépôt privé**, avec lancement
  manuel et quotidien, conservation de sept jours et arrêt au-delà de 40 Mio
  pour une archive. Ce fichier n'est pas installé dans les workflows de l'app.

Le dépôt de code actuel est public. Aucun export, même chiffré, n'y sera ajouté.
Le modèle refuse de sauvegarder depuis un dépôt public. Aucun secret ne doit
être placé dans un fichier du dépôt, un message, une capture ou un commentaire.

## Activation dans GitHub

1. Créer un dépôt **privé**, par exemple `nuvabri-backups`, avec un README pour
   initialiser sa branche principale. La connexion actuelle ne permet pas de
   créer un dépôt ou de gérer ses secrets. Autoriser ensuite l'accès à ce dépôt
   pour la connexion GitHub utilisée pour le projet.
2. Copier ce dossier dans `ops/backups/` de ce dépôt privé. Installer
   `github-backup.yml` comme `.github/workflows/backup.yml` sur sa branche par
   défaut. Cela ne nécessite aucune publication de l'application sur Vercel.
3. Dans **Settings → Secrets and variables → Actions**, enregistrer :

   | Type | Nom | Valeur à saisir directement dans GitHub |
   | --- | --- | --- |
   | Secret | `SUPABASE_DB_URL` | URL PostgreSQL du panneau **Connect → Session pooler** de Supabase, avec le mot de passe de la base et `?sslmode=require`. Port 5432. |
   | Secret | `NUVABRI_BACKUP_PASSPHRASE` | Secret aléatoire unique d'au moins 32 caractères, également conservé dans le gestionnaire de mots de passe du propriétaire. |
   | Variable | `NUVABRI_ZERO_SPEND_CONFIRMED` | `true`, seulement après la vérification de facturation ci-dessous. |

   L'URL doit cibler le projet existant `vkfvjwxajgeafzyphjvh`. Copier l'hôte
   exact affiché par Supabase; ne pas le reconstruire à partir de sa région.
   Encoder les caractères spéciaux du mot de passe dans l'URL. Ne pas remplacer
   ce mot de passe par la clé API publique ou `service_role`. Ne pas réinitialiser
   un mot de passe existant sans vérifier ses autres utilisations.

4. Dans la facturation GitHub, vérifier le quota de minutes et de stockage partagé
   avec les autres dépôts/Packages, et bloquer les dépassements payants. Le quota
   GitHub Free annoncé est de 2 000 minutes et 500 Mo d'artefacts; il n'est pas
   réservé à cette sauvegarde. Le modèle limite les archives à 40 Mio et leur
   durée à sept jours, mais les lancements manuels et les autres dépôts comptent
   aussi. **Le code seul ne garantit pas une facture de zéro.** Il faut la limite
   de dépenses du compte avant l'activation. Aucun abonnement n'a été souscrit.
5. Dans Actions, lancer **Nuvabri encrypted backup → Run workflow**. Vérifier
   que le travail `backup` réussit et qu'un artefact est téléchargeable. Un
   workflow ignoré ou bloqué n'est pas une sauvegarde. Télécharger une copie et
   vérifier son déchiffrement avant de compter sur la planification quotidienne.
6. Surveiller les échecs du workflow et télécharger régulièrement une copie
   chiffrée sur un support personnel. Les artefacts expirent après sept jours.
   Garder le secret de déchiffrement séparément : GitHub ne permet pas de relire
   un secret, et sa perte rend les archives inutilisables.

La planification GitHub s'exécute sur la branche par défaut; son heure peut être
retardée. Elle n'est pas active tant que ce modèle reste seulement dans la branche
de prévisualisation du dépôt de l'app.

## Exécution sur un ordinateur existant

Cette option n'utilise aucun service de stockage ou d'exécution payant. Installer
Python 3.11+, GnuPG, le client PostgreSQL (`psql`), Docker et Supabase CLI
**2.117.0**. Le programme vérifie la version et l'aide de la CLI avant les exports.
Configurer les deux secrets ci-dessus localement, hors Git et sans les écrire
dans l'historique du terminal. Puis :

```sh
python3 ops/backups/backup.py export --output /chemin/prive/nouvelle-sauvegarde
```

Le dossier doit être nouveau. L'export existant n'est jamais écrasé. Conserver
les deux fichiers résultants sur un support séparé de la base et du dépôt.
Le programme ne supprime pas les anciennes copies locales et ne met pas en place
de tâche planifiée sur l'ordinateur.

## Essai de restauration — seulement sur une cible isolée

1. Télécharger une archive dans un emplacement privé. Fournir localement
   `NUVABRI_BACKUP_PASSPHRASE`, puis vérifier et extraire :

   ```sh
   python3 ops/backups/backup.py unpack \
     --input /chemin/prive/backup.tar.gz.gpg \
     --output /chemin/prive/backup-restored
   ```

   Aucune base n'est modifiée par cette commande. Les fichiers extraits sont
   confidentiels et doivent rester hors du dépôt.
2. Préparer une instance Supabase isolée et vide, avec PostgreSQL 17 et des
   versions Auth/Storage compatibles. Utiliser une instance locale ou un projet
   gratuit disponible, sans activer de ressource payante. Confirmer explicitement
   que la cible n'est pas `vkfvjwxajgeafzyphjvh`. Ne jamais utiliser l'URL source
   comme cible et ne jamais restaurer par-dessus une base contenant des données.
3. Vérifier les extensions listées dans `inventory.json`. Garder les envois,
   webhooks, intégrations et tâches planifiées désactivés sur la copie.
   Les paramètres Auth, clés d'API, SMTP, fonctions Edge, publications Realtime
   et tâches cron ne sont pas restaurés automatiquement par cette archive.
4. Comparer le schéma Auth/Storage préinstallé à la source. Examiner
   `managed-customizations.sql` avant de restaurer les déclencheurs/politiques
   applicatifs. Le fichier capture les déclencheurs utilisant les fonctions
   `public`/`nuvabri_*`, pas les déclencheurs internes de la plateforme.
5. Avec `psql` sur la **cible vide uniquement**, utiliser `ON_ERROR_STOP=1` et
   une transaction unique. Avant de créer les tables applicatives, révoquer les
   privilèges par défaut de la cible sur les tables `public` pour `anon` et
   `authenticated`; sinon des droits supplémentaires peuvent être hérités.
   Restaurer dans l'ordre : `roles.sql`, `schema.sql`, `history-schema.sql`, puis
   les données de `data.sql` et `history-data.sql` avec les déclencheurs désactivés
   (`SET LOCAL session_replication_role = replica`). Restaurer ensuite les
   personnalisations applicatives et réactiver les déclencheurs. En cas d'erreur,
   annuler l'ensemble et corriger sur la cible isolée; ne pas ignorer une erreur
   de permissions ou une table manquante pour obtenir un résultat « vert ».
6. Vérifier les tables, clés étrangères, comptes Auth, budgets, propriétés,
   fonctions et politiques RLS. Les comptages d'`inventory.json` sont échantillonnés
   avant l'export, pas des compteurs atomiques si l'application reçoit des écritures.
   Chaque export de données PostgreSQL utilise son propre instantané cohérent;
   éviter les migrations de schéma pendant cette opération.
7. Exécuter `tests/household-invitations.sql` du dépôt applicatif sur la copie.
   Les 44 assertions doivent réussir. Tester également la lecture d'un budget
   et d'une propriété avec des identités autorisées. Ne pas ouvrir la copie au
   public ni envoyer de courriels aux comptes restaurés.
8. Consigner l'archive utilisée, la cible, les heures de début/fin, les contrôles
   et les éventuels composants manquants. La restauration n'est validée qu'après
   ce résultat, jamais à la seule création du fichier chiffré.

La présence future d'objets Storage ou de secrets Vault bloque volontairement
l'export avec ce programme : leur sauvegarde séparée ou la conservation de la clé
de chiffrement racine devra être préparée avant de reprendre. Aucun contenu de
Vault n'est lu ou affiché pour cette vérification.

## Vérifications réalisées

- 15 tests locaux : véritable chiffrement/déchiffrement GPG, mauvais secret,
  archive corrompue, empreintes, chemins malveillants, limites de taille, export
  incomplet, nettoyage après échec et refus d'un dépôt public.
- Les commandes d'export SQL sont simulées dans ces tests. **Aucun test de
  restauration PostgreSQL réelle n'a encore été réalisé.**
- Requêtes d'inventaire et de personnalisation vérifiées en lecture seule sur
  le projet. Aucun export des données réelles n'a été produit.

Références vérifiées le 2026-09-10 :

- [Sauvegardes gratuites par exports](https://supabase.com/docs/guides/platform/backups)
- [Exports et restauration Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Sauvegardes avec GitHub Actions](https://supabase.com/docs/guides/deployment/ci/backups)
- [Privilèges lors de la restauration](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Quotas et facturation GitHub Actions](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)
- [Déclenchement des workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
