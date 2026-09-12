# Validation actuelle — 12 septembre 2026

Consulter [qa-validation-20260912.md](qa-validation-20260912.md) pour les résultats et blocages actuels. Le lancement public reste à valider. Les sections ci-dessous conservent la chronologie et les décisions initiales.

# Nuvabri — ordre de travail avant lancement

Décision du 10 septembre 2026 : préparer une bêta ciblée, conserver le budget essentiel gratuit et financer progressivement l’application par des commerces partenaires. Ce document est une feuille de route, pas une attestation de conformité ou de disponibilité publique.

## Point d’avancement — premier lot préparé, non publié

Implémenté : quatre onglets, démarrage guidé, présentation avant inscription, ordre des contenus, opérations financières repliées, récupération de mot de passe, erreurs de chargement initial explicites, transparence et tri des commerces, consentement et reprise de demande dans un formulaire ouvert, préparation du pilote dans l’administration. Voir le README pour les limites et les 49 tests automatisés réussis.

Non implémenté / non activé : suppression de compte, politique officielle et gouvernance, correctifs des avertissements de sécurité, envois et rappels externes, mesure des affichages/clics, facturation, recrutement des partenaires, recette sur iPhone et avec deux comptes réels. Aucun paiement, envoi réel ou déploiement n’a eu lieu dans ce lot.

## Mise à jour — statistiques en préversion

Le lot de statistiques ajoute les mesures d’utilisation des membres connectés, les clics instrumentés et des signaux d’installation partiels. Le tableau admin sépare préversion et production, exclut les administrateurs par défaut et montre les limites de couverture. Les mesures n’ont pas d’historique avant activation et ne constituent pas une preuve d’achat, d’appel ou de livraison. Le détail et les vérifications figurent dans le README. Le suivi des livraisons, les impressions de fiches, l’acquisition de visiteurs anonymes et la facturation restent des travaux distincts.

## 1. Une expérience simple et utile

Identité visuelle intégrée en préversion : logo Nuvabri, signature, palette de marque stable et icônes navigateur/iPhone/manifeste. Les décors saisonniers sont conservés. Voir `assets/brand/README.md` pour les fichiers et les limites de vérification.

- Quatre destinations principales : Accueil, Mes biens, Finances, Plus.
- Conserver toutes les propriétés, régions, immeubles et unités; ne pas limiter le modèle à une maison et un chalet.
- Démarrage guidé : foyer, première propriété, équipements/tâches. Le budget reste accessible sans propriété.
- Accueil : prochaines tâches avant capsule financière et idée saisonnière. Conserver les guides DIY, le matériel et les équipements détaillés.
- Expliquer l’application avant l’inscription; conserver une connexion directe pour les membres existants.
- Garder les indicateurs financiers secondaires repliés, sans supprimer leurs données.

## 2. Comptes, données et fiabilité — indispensables avant bêta externe

- Récupération de mot de passe avec lien expiré, erreur réseau et confirmation explicite.
- Vérifier le parcours complet avec deux comptes de test autorisés et sur iPhone.
- Vérifier la configuration du courriel d’authentification et les URL de retour avant publication.
- Fixer le contact officiel de soutien et le responsable de la confidentialité, les durées de conservation et le processus de plainte. Ne pas inventer une adresse ou publier une politique générique comme finale.
- Faire valider la politique, l’évaluation des facteurs relatifs à la vie privée et le rôle du conseiller par les responsables appropriés.
- Concevoir la suppression de compte avec réauthentification, révocation de sessions et protection des biens partagés; ne pas supprimer les propriétés des autres membres en cascade.
- Revoir les avertissements de sécurité Supabase existants, la sauvegarde/restauration et la surveillance des erreurs.

## 3. Des communications dont le statut est exact

- Distinguer demande enregistrée, remise au service d’envoi, livraison confirmée et réponse du commerce. Un INSERT n’est pas une livraison.
- Vérifier les coordonnées des commerces destinataires; choisir/configurer l’expéditeur autorisé, les reprises, les doublons et les échecs avant envoi automatique.
- Invitations de foyer : enregistrement cloud et partage manuel clairement expliqués jusqu’à validation d’un véritable courriel.
- Rappels : annoncer l’affichage dans Nuvabri et l’export ponctuel .ics, pas une synchronisation ou une notification automatique inexistante.
- Aucun envoi de test à un utilisateur ou commerce réel sans autorisation.

## 4. Pilote partenaires — après fiabilisation du parcours

- Cible de test : cinq commerces complémentaires au Saguenay; aucune audience ni acquisition garantie.
- Hypothèse de prix : 79 $ CA par mois, résiliable mensuellement. Ce n’est ni un prix de marché validé ni un abonnement actif.
- Offre à valider : fiche, territoire/catégories pertinentes, visibilité commanditée, demandes reçues et bilan mensuel des résultats.
- Les fiches commanditées indiquent clairement leur statut. Le paiement ne donne ni vérification ni garantie de qualité.
- Préserver des résultats non commandités et permettre un tri sans priorité commerciale.
- Une demande est qualifiée seulement si besoin réel, coordonnées valides, bon territoire/service, consentement et absence de doublon. Définir les crédits pour demandes invalides avant toute tarification à la demande.
- Mesurer séparément affichages, clics, demandes enregistrées, demandes livrées et réponses. Ne jamais fabriquer de statistiques, de revenus ou de taux de conversion.
- Ajouter facturation, résiliation, factures, échecs de paiement et contrôle des droits seulement après validation de l’entité facturante, des modalités, des taxes applicables et du compte de paiement.
- Aucun paiement, collecte de carte, démarchage ou renouvellement automatique activé dans le premier lot.

## 5. Bêta et décision de lancement

- Hypothèse de cohorte : 20–30 foyers sur 4–6 semaines, à recruter avec autorisation.
- Observer première valeur utile, retour pour accomplir une tâche, demandes réellement reçues/répondues et charge de soutien.
- Comparer les revenus encaissés aux frais de paiement, infrastructure, soutien, acquisition et temps de gestion.
- Décider du lancement public seulement après les correctifs et essais, pas parce que la page répond.

## 6. Sources complémentaires — ensuite

- Affiliation contextuelle dans les guides DIY, avec programmes et divulgations vérifiés.
- Nouvelles fonctions premium avancées, sans retirer les fonctions essentielles existantes ni le multi-propriétés promis.
- Tarification à la demande seulement après validation de la qualité et du traitement des litiges; pas de double facturation des demandes incluses.
- Synchronisation bancaire en dernier, avec consentement et prestataire validé.
- Les références en assurance/placement sont distinctes des demandes à des entrepreneurs; faire valider leur rémunération par la conformité. Le budget n’est pas transmis automatiquement au conseiller ou aux commerces.

## 7. Nuvabri Pro — idée à reprendre dans un avenir rapproché

Idée du propriétaire consignée le 11 septembre 2026, à étudier après les essais de la bêta actuelle. Il s’agit d’une piste de développement, sans date de lancement ni tarif fixés.

- Public visé : travailleurs autonomes.
- Modèle envisagé : une offre Nuvabri Pro avec abonnement mensuel.
- Besoin principal : une gestion beaucoup plus poussée des revenus et dépenses professionnels tout en conservant une utilisation simple.
- Résultat souhaité : préparer le bilan de fin d’année et un dossier organisé à remettre au comptable, avec les revenus, dépenses et justificatifs correspondants.
- Fonction centrale demandée : prendre une simple photo d’un reçu ou d’une facture pour que Nuvabri lise les informations, classe la dépense et la comptabilise.
- Points de conception à préciser : validation/correction des informations reconnues, détection des doublons, distinction des dépenses personnelles et professionnelles, et format d’export attendu par les comptables.

Cette note conserve l’idée pour les prochaines discussions; elle n’active aucun abonnement, traitement de reçus ou service comptable.

## Points nécessitant une décision du propriétaire

1. Courriel officiel de soutien et coordonnées du responsable de la confidentialité.
2. Expéditeur et service de courriel autorisés pour les invitations, rappels et demandes.
3. Entité facturante, modalités commerciales et validation de conformité avant paiements.
4. Autorisation de publication de la version préparée et comptes de test autorisés pour la recette connectée.
