# Nuvabri — protocole de test sur cinq jours

Version préparée le 13 septembre 2026. **Document prêt à adapter; campagne non envoyée et date de départ non fixée.** Le responsable remplit le lien stable, la version retenue et le contact avant diffusion.

## Préparation par le responsable

- Fermer les points « avant le pilote » de l’[audit](audit-20260913.md), dont les lenteurs inexpliquées et la recette des outils détaillés. Ce protocole ne les déclare pas corrigés.
- Choisir quatre à six personnes, dont au moins deux sur iPhone et deux sur Android. Inclure une personne peu à l’aise avec les applications, un propriétaire avec plusieurs biens et une personne sans propriété. Si possible, inclure un couple pour le partage volontaire.
- Fournir un compte ou une inscription de test distincte par personne. Utiliser des montants fictifs et des biens nommés « TEST ». Ne jamais échanger les mots de passe.
- Remplir : **lien bêta stable : à fournir**; **version testée : à figer**; **dates : à fixer**; **contact privé de soutien : à confirmer**. Le lien doit durer au moins cinq jours et fonctionner sans compte Vercel.
- Faire le passage préparatoire de la matrice des champs : chaque option de liste, champ facultatif vide, champ obligatoire vide, date impossible, montant négatif, zéro permis/interdit, cents, texte long et annulation. Rejouer toute anomalie corrigée.
- Définir un destinataire contrôlé et autorisé pour les courriels ou demandes à tester. Aucune demande fictive à un vrai commerce ou conseiller sans accord préalable.

## Message d’accueil à copier lorsque le lien est prêt

« Merci d’essayer Nuvabri pendant cinq jours! L’objectif est de voir si tu peux organiser tes biens et comprendre ton budget facilement. Prends environ 10 à 15 minutes par jour, utilise les exemples fictifs ci-dessous et dis-nous dès qu’un montant ne s’enregistre pas ou qu’une étape n’est pas claire. Ce n’est pas toi qu’on évalue : on veut améliorer l’application. »

## Jour 1 — première impression et accès

1. Ouvrir le lien dans Safari sur iPhone ou Chrome sur Android. Résultat attendu : Nuvabri s’ouvre sans demander de compte Vercel.
2. Créer ou ouvrir le compte de test. Vérifier les messages pour un courriel mal écrit, un champ requis vide et un mot de passe trop court. Utiliser ensuite des valeurs valides.
3. Observer l’accueil pendant dix secondes, sans explication. Écrire : « À quoi sert Nuvabri? Quelle serait ma première action? »
4. Ouvrir Accueil, Mes biens, Finances et Plus. Revenir à l’accueil. Résultat attendu : navigation claire, aucun bouton caché par la barre inférieure.
5. Sans créer de propriété, trouver les boutons d’ajout d’un revenu et d’une dépense. Le budget doit être utilisable sans maison.
6. Se déconnecter puis se reconnecter. Noter toute erreur, champ inattendu ou donnée manquante.

À remettre : modèle du téléphone, version du système, navigateur, heure et deux phrases sur la première impression. Chronométrer seulement la recherche du bouton revenu/dépense; aucun objectif de rapidité imposé au testeur.

## Jour 2 — revenus, dépenses, CELI et REER

Utiliser un compte sans opérations de test antérieures dans le mois sélectionné.

| Action | Résultat attendu |
|---|---|
| Enregistrer un revenu reçu de 1 000 $ à la date du jour | Une seule opération de 1 000 $ |
| Enregistrer une dépense de 25 $ | Revenus 1 000 $, dépenses 25 $, solde des opérations 975 $ |
| Fermer et rouvrir Nuvabri | Les deux opérations restent présentes une seule fois |
| Prévoir un CELI de 50 $ par semaine et un REER de 25 $ par semaine dans Mes montants, puis enregistrer | Projection sur 52 semaines : CELI 2 600 $, REER 1 300 $. Ce ne sont pas des soldes de comptes confirmés et aucun rendement n’est ajouté. |
| Revenir aux opérations sans confirmer de versement réel | Elles restent à 25 $ de dépenses : prévoir une cotisation n’est pas l’avoir versée. |
| Utiliser l’action de versement réel pour confirmer 50 $ au CELI | Une nouvelle opération de 50 $; dépenses 75 $, solde des opérations 925 $ |

Saisir également 12,50 $ dans un brouillon, modifier la catégorie puis annuler : aucune nouvelle opération ne doit être créée. Tester 12.50 si le clavier propose un point. Un séparateur refusé doit donner une explication, jamais enregistrer 1 250 $.

Dans un plan séparé ou en remplaçant uniquement les montants fictifs, tester le signe du solde avec un revenu mensuel de 1 000 $ : dépenses mensuelles de 800 $ → +200 $; de 1 200 $ → −200 $; de 1 000 $ → 0 $. Pour ce contrôle, retirer les autres lignes et réserves fictives. Résultat attendu : positif visuellement positif, déficit rouge, zéro neutre; le texte explique le signe sans dépendre seulement de la couleur.

Question sans aide : « Quelle différence fais-tu entre Mes montants et les opérations? »

## Jour 3 — propriétés, loisirs et dépenses liées

1. Ajouter une propriété nommée « TEST maison ». Essayer ses champs et les équipements qui s’appliquent. Ouvrir et relire sa fiche.
2. Ajouter « TEST remorque » avec le type Remorque. Le type et les tâches pertinentes doivent apparaître; « Autre » ne doit pas être nécessaire.
3. Lui associer 70 $ par semaine, puis enregistrer. Vérifier une seule ligne de paiement lié dans le budget. Estimation sur 52 semaines : **3 640 $ par an**, soit **303,33 $ par mois en moyenne**.
4. Modifier le même paiement à 80 $ par semaine. La même ligne doit être mise à jour : **4 160 $ par an**, soit **346,67 $ par mois en moyenne**. Aucun second paiement prévu de 70 $ ne doit rester.
5. Renommer et modifier l’année de la remorque, puis fermer et rouvrir. Vérifier que le paiement et les tâches restent attachés à cette fiche.
6. Enregistrer séparément une dépense déjà payée de 70 $ pour cette remorque. La supprimer ensuite comme bien de test, après lecture de la confirmation. Le paiement futur lié disparaît, mais la dépense passée reste dans les opérations.
7. Ajouter une seconde propriété « TEST chalet ». Créer des tâches de même titre dans les deux propriétés, terminer une tâche récurrente et vérifier qu’elle se renouvelle dans la bonne propriété. Supprimer uniquement la propriété de test choisie.

Attention au calendrier : les valeurs annuelles ci-dessus sont des estimations à 52 semaines. Un mois de quatre versements de 80 $ vaut 320 $ et un mois de cinq en vaut 400 $. Ne pas comparer ces montants au 346,67 $ de moyenne sans regarder le libellé et la période.

À remettre : toute difficulté pour modifier/supprimer, un montant lié manquant ou un doublon. Ne supprimer aucune vraie propriété pendant ces essais.

## Jour 4 — interruptions et confidentialité

1. Commencer une dépense fictive de 10 $. Couper temporairement la connexion, tenter l’enregistrement puis la rétablir. Résultat attendu : pas de faux message de réussite, saisie conservée ou reprise clairement expliquée.
2. Réessayer et appuyer rapidement deux fois sur Enregistrer. Après confirmation et rechargement, il doit y avoir une seule nouvelle opération de 10 $.
3. Saisir un brouillon, passer à une autre application pendant quelques minutes, revenir. Vérifier la saisie, le clavier et l’accès au bouton.
4. Sur un appareil contrôlé, se déconnecter du compte A puis ouvrir un compte B de test. Aucun budget, montant ou loisir privé du compte A ne doit apparaître. Les propriétés intentionnellement partagées constituent un cas séparé avec des droits limités.
5. Avec une boîte courriel de test autorisée, demander la récupération du compte. Vérifier réception, retour dans Nuvabri, nouveau mot de passe et refus de réutiliser un ancien lien. Cette opération doit être organisée par le responsable; ne pas demander de réinitialisation pour quelqu’un d’autre.
6. Si le partage est inclus, le propriétaire invite le second testeur comme lecteur d’une propriété de test. Le lecteur la voit sans pouvoir la modifier ni ouvrir les propriétés non partagées. Une invitation révoquée ne doit pas restaurer l’accès.

Arrêt immédiat si les données d’un autre compte apparaissent ou si une somme est perdue/dupliquée. Noter l’heure et prévenir le responsable en privé; éviter de multiplier les tentatives.

## Jour 5 — utilisation autonome et bilan

1. Revenir sans consigne sur l’accueil et choisir une tâche utile. Retrouver le bien et son entretien.
2. Depuis un entretien, proposer un coût fictif au budget, confirmer puis enregistrer. Répéter l’action : elle doit modifier le même élément prévu, sans doubler son coût.
3. Ouvrir un guide, chercher un professionnel adapté à la propriété, changer le filtre puis revenir. Le territoire et le service doivent rester pertinents. Une fiche n’est pas une garantie de qualité.
4. Ouvrir la fiche du conseiller. Le test s’arrête avant l’envoi sauf destinataire de test autorisé. Vérifier que le budget n’est pas annoncé comme transmis automatiquement.
5. Essayer le texte agrandi, le téléphone en paysage, le retour arrière et l’ajout à l’écran d’accueil si disponible. Cette installation Web ne prouve pas une disponibilité sur les boutiques Apple ou Google.
6. Fermer, rouvrir et vérifier les derniers montants. Terminer le questionnaire ci-dessous.

## Questionnaire final

- En une phrase, qu’est-ce que Nuvabri t’aide à faire?
- Quelle somme représente l’argent disponible, et pour quelle période?
- As-tu compris ce qui est prévu et ce qui est déjà payé? Donne un exemple.
- Quelle action était la plus facile? Où t’es-tu perdu?
- Quelle information manquait pour prendre une décision?
- Qu’enlèverais-tu de l’accueil ou du budget?
- Reviendrais-tu utiliser Nuvabri la semaine prochaine? Pour quoi?
- Comprends-tu pourquoi et comment contacter le conseiller, sans te sentir obligé?
- Sur 5 : facilité de saisie; clarté des montants; confiance dans la sauvegarde. Expliquer toute note de 1 à 3.

## Fiche de problème à copier

**Date et heure / fuseau :**
**Téléphone, système et navigateur :**
**Version ou lien testé :**
**Écran :**
**Étapes effectuées :**
**Résultat attendu :**
**Résultat obtenu / message exact :**
**Le problème revient-il après fermeture et reconnexion?**
**Capture avec les données personnelles masquées, si utile :**

Ne pas transmettre de mot de passe, jeton, numéro de compte ou capture contenant le budget d’une autre personne.

## Décision après cinq jours

Seuils proposés pour décider, et non résultats déjà obtenus :

- Aucune perte de donnée, aucun doublon financier et aucun accès privé non autorisé dans les scénarios exécutés.
- Les parcours essentiels passent sur les deux plateformes : connexion, récupération, enregistrement/relecture, édition/suppression de biens, paiements liés et déconnexion.
- Au moins 80 % des testeurs trouvent l’ajout revenu/dépense en moins de 15 secondes après leur première utilisation et peuvent expliquer le solde sans aide. Avec quatre à six personnes, ce résultat donne une direction; il ne représente pas tout le marché.
- Les erreurs restantes sont documentées, avec une décision et une correction vérifiée pour chaque blocage. Les outils détaillés inclus ont eux aussi passé leur recette.
- Le contact de soutien et la procédure de traitement des incidents fonctionnent. Les autres conditions de lancement, dont la suppression de compte et les documents officiels, sont fermées séparément.

Le responsable produit un relevé : scénarios réussis/essayés, problèmes critiques, incompréhensions répétées, correctifs retenus et décision de poursuivre, prolonger le pilote ou préparer une diffusion plus large.
