# Nuvabri — suivi de validation du 14 septembre 2026

Application personnelle · Branche `preview/beta-20260910` · Complément à l’[audit du 13 septembre](audit-20260913.md).

## État de préparation

### Correctifs de reprise réseau — demande de sortir le pilote de cinq jours

Le 14 septembre, la reprise du navigateur de contrôle échoue toujours sur `refresh tabs`, y compris la lecture de l’alerte déjà ouverte. La découverte documentée ne propose qu’un navigateur Chrome. Aucune nouvelle tentative de connexion ni autre surface de contrôle n’a été utilisée. Le contrôle visuel connecté demeure bloqué par cet outil.

Le diagnostic distingue la base et le transport : les dix requêtes budgétaires les plus lentes encore présentes dans `pg_stat_statements` ont un maximum inférieur à 246 ms. Ce relevé ne couvre pas les demandes qui ne sont pas parvenues à PostgreSQL et ne prouve pas la cause historique des quatre 504. Le nouvel endpoint répond correctement 401 sans session. La dernière préversion ne présente pas de trafic connecté suffisant pour conclure que les erreurs ont disparu.

Correctifs préparés :
- Deux tentatives maximum pour les lectures GET/HEAD du relais financier en cas de 502/503/504 ou d’interruption réseau. Chaque tentative couvre le téléchargement complet et est bornée à six secondes. Un délai demandé par le fournisseur supérieur à une seconde n’est pas ignoré.
- Aucun réessai automatique pour POST/PATCH/DELETE, ni pour une erreur de session, de permission ou de quota. Les identifiants de reprise et les versions restent contrôlés par les formulaires.
- Les lectures identiques simultanées partagent un appel côté client. Les comptes et en-têtes distincts ne sont jamais regroupés, aucun résultat terminé n’est conservé, et toute écriture invalide les lectures en cours pour le rafraîchissement suivant.
- Réponses du relais non mises en cache, y compris les refus de session; journaux techniques limités à la route, table, méthode, statut, durée et nombre de tentatives.
- Durée maximale explicite de vingt secondes pour `api/budget-data.js`, sans changement d’offre ou ajout de fonction.

Vérification : **279 tests JavaScript réussis, zéro échec, un test navigateur non exécuté**. Les huit nouveaux essais couvrent récupération, corps de réponse interrompu, limite des reprises, absence de reprise des écritures, séparation des comptes, invalidation après écriture et reprise manuelle. Les vérifications SQL des six outils financiers ont de nouveau réussi, toutes les données fictives étant annulées par ROLLBACK.

Ces résultats démontrent la résistance aux erreurs simulées et l’isolation dans la base; ils ne constituent pas une observation connectée de la correction sur téléphone. Le propriétaire a confirmé la lecture sonore de la vidéo; la version MP4 avec son stéréo est retenue.

Accès pilote : l’outil Vercel disponible fixe ses liens à 23 heures. L’API officielle permet `ttl: 432000`, mais aucune authentification Vercel de terminal n’est configurée ici. L’accès connecté existant ne fournit pas l’opération avec cette durée. Le navigateur bloqué empêche également une configuration par le tableau de bord. **Le lien de cinq jours n’est pas créé, la campagne n’est pas lancée.** Le propriétaire a déjà autorisé ce travail; le blocage est technique et non un manque d’autorisation.

Sources techniques consultées : [durée des fonctions Vercel](https://vercel.com/docs/functions/configuring-functions/duration), [diagnostic HTTP Supabase](https://supabase.com/docs/guides/troubleshooting/http-api-issues), [durée du lien de partage Vercel](https://vercel.com/docs/rest-api/aliases/update-the-protection-bypass-for-a-url).


### Reprise autorisée — vidéo avec voix et contrôle connecté

Après l’autorisation explicite du propriétaire, la connexion sécurisée a réussi dans le navigateur de contrôle, sur la préversion `11bfaf49126d4aa218c3c9ba194455a3214a46e1` / `dpl_Bkgs1EKc9v3qVN4TxYCoUiDAPaLt`. Les commandes de l’espace connecté, l’accueil, le budget et les opérations ont été observés. Le budget prévu a fini son chargement et affichait « Ton budget est enregistré ». Cette reprise lève le blocage de connexion décrit historiquement plus bas.

Un essai de montant nul, avec la description fictive `TEST CODEX 14SEP dépense`, a déclenché une alerte native. Le navigateur de contrôle a ensuite renvoyé des délais d’attente sur l’inspection et la fermeture de cette alerte. L’ouverture d’un nouvel onglet et la demande de contrôle manuel n’ont pas rétabli l’inspection. Aucune autre méthode d’accès, lecture de jeton ou automatisation externe n’a été employée. Aucun nouveau montant valide n’a été soumis et aucune donnée existante n’a été modifiée. Le parcours connecté complet reste **partiel**, et non validé champ par champ.

Le correctif de ce lot remplace l’alerte native d’échec d’enregistrement par un message visible et focalisé dans le formulaire. Les six champs d’une opération ont maintenant des libellés associés; le montant présente un clavier décimal et un minimum de 0,01 $. Les valeurs restent disponibles en cas d’erreur. Quatre essais de comportement supplémentaires vérifient : montant nul puis correction, date manquante, deux clics concurrents et réponse serveur sans confirmation. La suite complète donne **271 réussites, 0 échec, 1 test navigateur non exécuté** (272 au total). Ces essais utilisent des composants simulés et ne valident pas la nouvelle interface sur un téléphone.

Le relevé Vercel de 00 h 20 à 01 h 20 UTC, le 14 septembre, montre **quatre GET `/api/budget-data` en 504 vers 01 h 10** sur la préversion testée. La cause n’est pas établie. Le chargement réussi du budget principal ne permet donc pas de déclarer les outils secondaires fiables dans toutes les conditions. Les journaux d’erreur consultés séparément n’apportent pas de diagnostic pour ces quatre réponses. Ce point reste ouvert avant le pilote.

La vidéo est maintenant **narrée en français**, avec la mission en première scène, dix écrans, des sous-titres français et une durée vérifiée de **2 min 09 s**. Elle présente le parcours, les exemples budgétaires, cinq jours d’essai et les retours attendus. Format : 720 × 1280, H.264 / AAC, environ 3 Mo. Le décodage du fichier complet a réussi; le niveau sonore mesuré ne présente pas d’écrêtage. Les dix écrans ont été inspectés. Il s’agit d’une voix de synthèse générique et d’illustrations, sans imitation du fondateur ni données personnelles. Le guide PDF de deux pages reste inchangé. Les sources, le scénario et la transcription accompagnent la vidéo.

**Aucun lien de campagne de cinq jours créé, aucune invitation envoyée et aucun lancement public.** La durée commencera après résolution des blocages et validation du déploiement retenu.


### Reprise après les confirmations du propriétaire

Le propriétaire a confirmé que la connexion et le parcours d’une dépense de test fonctionnent sur son appareil : ajout de 12,50 $, modification à 15 $, suppression, conservation du résultat après réouverture et ajustements correspondants du solde. Ce sont des **essais rapportés par le propriétaire**, pas des observations directes du navigateur de validation. L’essai de revenu de 100 $ a été proposé, mais n’a pas été confirmé dans la conversation.

À la reprise demandée, le contrôle automatique a refusé une nouvelle requête de connexion sécurisée. Motif annoncé : la précédente erreur générique de connexion impose l’arrêt des tentatives en l’absence d’une résolution explicitement dirigée par l’utilisateur. Il ne s’agissait pas d’un refus manuel du propriétaire. Aucun autre moyen de connexion, jeton ou session n’a été utilisé pour contourner ce refus. **L’audit complet champ par champ reste bloqué.**

Le complément sur les fiches équipement ajoute huit tests : tous les champs du détecteur, dates et liens invalides, double clic, réponse perdue, édition concurrente, ouverture d’une autre fiche pendant l’enregistrement, déconnexion et changement de propriété. Les fiches utilisent maintenant une version conditionnelle, conservent les champs en cas d’erreur et ignorent une réponse destinée à une fiche fermée. La date, le fournisseur, la garantie, l’entretien et les notes sont synchronisés avec les colonnes correspondantes. Le texte relatif aux documents décrit les liens utilisables et l’indisponibilité actuelle du téléversement.

La suite complète donne désormais **267 réussites, 0 échec, 1 test navigateur non exécuté**. `tests/equipment-profile-rls.sql` a également réussi dans Supabase : conservation des champs, mise à jour du propriétaire avec version, rejet d’une version périmée, refus de lecture/modification par un autre propriétaire. Toutes les données fictives ont été annulées par `ROLLBACK`. Cette preuve ne remplace pas la recette de partage entre membres ni les essais visuels.

Une vidéo de présentation verticale de 2 min 10 s, sans voix off, et une fiche PDF de deux pages sont préparées pour **4 à 5 testeurs**. La vidéo est composée de textes et schémas illustratifs; ce n’est pas un enregistrement de parcours connectés validés. Elle reprend la signature de marque approuvée et présente la mission, les onglets, les exemples budgétaires et les retours attendus.

### Accès de cinq jours, à créer après validation

La limite de 23 h concerne l’outil de partage utilisé précédemment. La [documentation officielle Vercel](https://vercel.com/docs/rest-api/aliases/update-the-protection-bypass-for-a-url), consultée à cette reprise, décrit un paramètre `ttl` en secondes pour un lien de partage d’une URL ou d’un déploiement. Cinq jours correspondent à `432000` secondes. La préparation retient un déploiement figé, une création au début du pilote et la vérification de l’expiration retournée, avec un essai sans compte Vercel. La connexion Nuvabri restera nécessaire. L’accès API authentifié permettant cette durée reste à vérifier; aucun lien de cinq jours n’a été créé et aucune protection globale n’a été désactivée. Aucun départ ni invitation n’est lancé avant la validation.

### État documenté avant cette reprise

Les correctifs des outils financiers détaillés sont publiés en préversion au commit `2413899b705c8b2d302b8bdbac9ec3c2451ce3b0`, déploiement `dpl_97suCzuxx2AKNUi4W5diMASJKziP` confirmé `READY`. **Le lancement public et la recette exhaustive sur téléphone ne sont pas validés.** Le navigateur de contrôle est de nouveau fonctionnel et l’écran de connexion Nuvabri s’ouvre. La connexion sécurisée a été soumise, puis Nuvabri a affiché « Impossible de terminer pour le moment. Vérifie ta connexion puis réessaie. » Aucun signal positif de connexion n’a été observé. La cause reste inconnue; cet écran ne démontre pas un mauvais mot de passe. La recette connectée est donc bloquée à cet endroit, sans répétition automatique des tentatives.

La comparaison avec HomeZada, YNAB, Monarch et Neontra reste celle du rapport précédent : Nuvabri propose une combinaison intéressante pour les ménages québécois, mais les preuves ne justifient pas une avance globale ou une exclusivité commerciale. Ce lot améliore la fiabilité avant l’ajout de fonctions.

## Correctifs de ce lot

| Parcours | Comportement corrigé | Vérification exécutée |
|---|---|---|
| Ajouter à un objectif d’épargne | Formulaire visible, montant en cents, annulation; une modification concurrente bloque l’écrasement. Une confirmation perdue ne permet pas d’ajouter deux fois le même montant par une nouvelle tentative sur la même version. | Doubles clics, modification concurrente, réponse perdue après écriture, champs conservés. |
| Solde d’une dette après paiement | Le client confirme le solde de son relevé. Si le taux ou le paiement manque, aucun solde n’est inventé. Une proposition calculée reste indicative. Un solde nul ferme la dette et enlève sa prochaine échéance. | Taux absent, remboursement complet, cents, confirmation perdue, conflit. |
| Prochaine échéance | Date proposée à vérifier; fins de mois et années bissextiles prises en compte. Pour deux paiements par mois, le client renseigne la prochaine date réelle. | Dates invalides, février, 29 février, fréquence inconnue et changement concurrent. |
| Hypothèque | Une actualisation ne remplace plus les champs en cours d’édition. Une version concurrente oblige à vérifier avant d’enregistrer. Ajout/modification attend la première lecture réussie pour éviter de créer une fiche faute d’avoir chargé l’existante. | Brouillon pendant actualisation, conflit, première lecture retardée et échec de lecture. |
| Chargements des cinq outils | Les erreurs de lecture ne deviennent pas des montants à zéro. Les réponses dépassées sont ignorées; les fiches et brouillons sont effacés lors du changement de compte. | Déconnexion pendant lecture, réponse de l’ancien compte après connexion du nouveau, deux actualisations dans l’ordre inverse, erreur réseau. |
| Suppression des fiches financières | Suppression conditionnelle selon la version lue, erreurs affichées; une suppression déjà effectuée peut être confirmée à la reprise. | Échec de suppression, répétition et versions périmées. |

Les cinq outils concernés sont les objectifs d’épargne, dettes, actifs du patrimoine, paiements récurrents et renouvellements hypothécaires. Les mises à jour contrôlent l’identifiant du propriétaire et la version `updated_at` lue. Les nouveaux clients changent cette version à chaque écriture. Les anciennes préversions doivent être retirées du protocole de test; ce contrôle ne transforme pas les anciennes écritures sans changement de version en écritures versionnées.

Ces outils ne créent pas implicitement une opération budgétaire. Le versement réel CELI/REER du budget principal reste un parcours distinct. Les dates proposées ne constituent pas l’échéancier contractuel du prêteur; la date d’origine complète n’étant pas conservée, le client confirme chaque échéance proposée. Les champs sont conservés pendant une erreur dans le formulaire ouvert; aucune nouvelle garantie de brouillon après fermeture de la page n’est ajoutée.

## Résultats vérifiés

- `node --test tests/*.test.mjs` : **259 réussites, 0 échec, 1 test navigateur non exécuté**. Les scénarios de formulaires utilisent un DOM et un réseau simulés. Ils ne constituent pas des essais physiques sur 259 appareils.
- `tests/budget-tools-rls.sql`, exécuté dans Supabase : **réussite sur six tables**. Insertion répétée sans doublon, lecture propriétaire, modification avec version courante, rejet des modifications/suppressions avec ancienne version, refus de transfert de propriété et d’accès par un autre compte, suppression par le propriétaire. Données fictives et transaction annulée par `ROLLBACK`.
- Aucun changement de schéma ou de permissions dans ce lot. Aucun compte réel ni montant réel modifié par les essais SQL.
- Le relevé des erreurs 5xx sur la préversion `304035e`, fenêtre de 24 h consultée le 14 septembre, n’a renvoyé aucun journal. **Cela ne prouve pas que les 504 observées le 13 septembre sont résolues** : aucun trafic connecté représentatif n’a encore été reproduit dans cette recette.
- Le relevé 5xx sur `dpl_97suCzuxx2AKNUi4W5diMASJKziP`, de 23 h 31 UTC le 13 septembre à 0 h 31 UTC le 14 septembre, ne renvoie aucun journal non plus. Les appels d’authentification du client vont directement à Supabase; les journaux Vercel seuls ne permettent pas d’expliquer l’échec de connexion.
- Les preuves de sauvegarde/restauration du 12 septembre restent dans [la validation précédente](qa-validation-20260912.md); ce lot n’a pas relancé une restauration sans nécessité.

## Complément à la matrice des champs

La [matrice du 13 septembre](audit-champs-20260913.csv) reste un inventaire de déclarations source, pas une preuve que tous les champs dynamiques ont été exercés. Les quatre champs ajoutés dans ce lot sont recensés ci-dessous. Leur recette dans le navigateur reste à faire.

| Fichier | Champ | Contraintes | Scénarios automatisés |
|---|---|---|---|
| `budget-savings-goals.js` | `hpSavingsContributionAmount` | Montant obligatoire, minimum 0,01 $, pas de 0,01 $ | Cents, double clic, conflit, confirmation perdue |
| `budget-debts-loans.js` | `hpDebtRemaining` | Solde obligatoire, minimum 0 $, pas de 0,01 $ | Taux absent, solde confirmé, remboursement complet, reprise |
| `budget-debts-loans.js` | `hpDebtFollowingDate` | Date réelle requise si solde positif, après l’échéance précédente | Date manquante, fréquence deux fois par mois, confirmation |
| `budget-recurring-payments.js` | `hpRecurringNext` | Date réelle obligatoire après l’échéance précédente | Proposition de fin de mois, vérification, conflit |

## Ce qui reste avant le pilote

1. Comprendre l’erreur générique de connexion rencontrée, puis reprendre avec un compte de test dans le navigateur sécurisé. Vérifier les créations, modifications, suppressions, reconnexions et relectures sur la nouvelle préversion. Reproduire les chargements budgétaires et examiner les journaux correspondants. Ne pas tenter de contourner un éventuel blocage de connexion par le site; [aide sur les blocages du navigateur cloud](https://help.openai.com/articles/20001280-using-cloud-browser-in-chatgpt#when-a-website-blocks-the-task).
2. Compléter la recette physique iPhone et Android, y compris clavier décimal, grands caractères, navigation arrière, réseau interrompu et reprise de session. Ne pas cocher ces cases sur la seule base des tests de code.
3. Préparer un lien bêta stable pendant toute la campagne, vérifié sans compte Vercel. Les liens temporaires de partage générés ici expirent après 23 h et ne conviennent pas seuls aux cinq jours.
4. Achever les contrôles des autres chargeurs secondaires et fiches équipement signalés dans l’audit précédent. Les protections nouvelles des cinq outils ne ferment pas automatiquement les points des autres modules.

Avant le lancement public, les points de suppression complète du compte, coordonnées officielles/politique finale, courriels et avis de sécurité restent ouverts dans le suivi. Aucun avis n’est déclaré fermé sans vérification correspondante.

Le [protocole de cinq jours](protocole-testeurs-5-jours.md) est préparé; la campagne n’a pas été envoyée. La publication de ce lot concerne uniquement la préversion. Aucun lancement public, message externe, modification de Nuvabri Pro ou dépense payante n’est inclus.
