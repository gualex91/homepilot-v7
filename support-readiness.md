# Centre de messages HomePilot — première version

## Livraison

Code préparé, non publié sur Vercel. Le schéma additif `homepilot_support_inbox`
a été appliqué au Supabase existant le 10 septembre 2026. Ses trois nouvelles
tables sont vides; aucune donnée existante n’a été modifiée.
Réception, envoi et IA sont désactivés par défaut. Aucun courriel réel ni appel
IA payant n’a été effectué pendant la réalisation.

Prévisualisation : lorsque `VERCEL_ENV=preview`, les trois intégrations restent
désactivées, même si des variables serveur sont déjà configurées. La base
Supabase reste celle de l’application actuelle : les essais automatisés utilisent
des données simulées, sans écriture dans les comptes réels. Les essais connectés
avec un compte autorisé et sur iPhone restent nécessaires.

## Fonctionnement

- Administration des professionnels → Messages; accès réservé aux administrateurs.
- Liste paginée par 100, recherche parmi les messages chargés, filtre par statut
  et bilan par catégorie. Le bilan indique explicitement s’il est partiel.
- Saisie manuelle et réception Resend signée : enregistrement durable, classement
  par règles et extrait du texte. Ce classement n’est pas présenté comme une IA.
- Texte brut uniquement; aucun HTML actif, image distante ou pièce jointe importée.
- Catégorie, priorité, statut et brouillon éditables, avec contrôle de version.
- IA uniquement sur demande d’un administrateur, si activée. Les dossiers identifiés
  comme sensibles ne sont pas transmis au modèle. Aucun accès aux budgets,
  propriétés ou autres données de compte; aucun outil accessible au modèle.
- Résultat IA et consommation en jetons conservés avant application au dossier;
  historique consultable dans l’admin et via `/api/support?generation=<uuid>`
  avec authentification. Coût monétaire inconnu (NULL), jamais présenté comme zéro.
- Approbation humaine avant envoi, avec confirmation supplémentaire pour les
  dossiers sensibles. Historique du texte, destinataire et approbateur.
- Réservation atomique de l’envoi et identifiant Resend stable sur reprise.
  Après 23 heures, vérification manuelle obligatoire avant toute autre tentative.
- « Accepté par le service » ne signifie pas « livré ». Un envoi incertain bloque
  les modifications et nouveaux envois du dossier jusqu’à sa vérification.
- Déconnexion ou changement d’utilisateur : fermeture et effacement des messages
  dans l’interface. Aucun stockage des courriels dans localStorage/sessionStorage.

## Vérifications

- 12 nouveaux tests automatisés; les 49 tests antérieurs passent aussi.
- Signature vérifiée contre le vecteur officiel Svix. Corps altéré, horodatage
  périmé, session absente/expirée, faux rôle dans user_metadata, non-admin,
  révision obsolète, envoi non approuvé et reprise trop ancienne refusés.
- Tests transactionnels Supabase, entièrement annulés : droits admin, refus de
  lecture/écriture non-admin, refus anonyme, approbation sensible, reprise
  identique, contenu de reprise modifié et révision périmée.
- Aucune alerte du contrôle Supabase ne porte sur les nouvelles tables/fonction.
  Les alertes antérieures restent : fonctions SECURITY DEFINER accessibles,
  tables RBQ sans politique et protection des mots de passe compromis désactivée.
  Les examiner séparément avant la bêta publique.
- Pas d’essai navigateur/iPhone, de livraison réelle ou d’évaluation qualitative
  d’un modèle connecté. Les appels courriel/IA des tests sont simulés.

## Activation restante

1. Publier la branche revue en prévisualisation, puis vérifier l’admin avec un
   vrai compte autorisé et un compte non-admin, notamment sur iPhone.
2. Acquérir/confirmer le domaine et configurer ses DNS Resend. Ne pas remplacer
   les MX d’une messagerie existante : prévoir un sous-domaine ou un transfert
   adapté après vérification de l’usage actuel.
3. Renseigner les variables serveur de `.env.example`. Aucun secret dans le
   navigateur, Git ou une conversation. La connexion Resend de ChatGPT ne fournit
   pas automatiquement une clé à l’application déployée.
4. Créer le webhook Resend `email.received` vers `/api/support-inbound`, enregistrer
   son secret et les adresses admises. Activer la réception et effectuer un test
   autorisé. Une réponse 503 signifie que le branchement applicatif est inactif.
5. Valider l’information aux utilisateurs, les accès administrateurs, le traitement
   des demandes sensibles et la durée de conservation. Le masquage simple avant
   IA n’est pas une anonymisation complète : des renseignements personnels peuvent
   demeurer. Aucune suppression/règle de conservation automatique n’est activée.
6. Autoriser/configurer l’accès IA, choisir explicitement un modèle compatible avec
   Responses + Structured Outputs et un plafond de dépenses chez le fournisseur.
   Le garde-fou de 20 préparations récentes par admin n’est pas un plafond
   budgétaire atomique. Tester avec des exemples fictifs avant les messages réels.
7. Autoriser un test d’envoi vers une adresse contrôlée, puis activer l’envoi.
   Vérifier erreurs fournisseur, reprises et livraison finale avant les clients.

## Limites de cette première version

Pas de réponse autonome, d’accusé automatique, de fusion des fils entrants,
de téléchargement des pièces jointes, de notification externe, de correction
automatique du produit, de conseil financier personnalisé ou de suppression de
compte. Chaque courriel entrant est un dossier distinct; les réponses sortantes
utilisent In-Reply-To lorsque disponible.

La détection des messages sensibles par mots-clés n’est pas infaillible. Toute
réponse doit être relue. Ne jamais autoriser une action sur un compte sur la seule
base d’une adresse courriel : utiliser le canal connecté de vérification approprié.

Un envoi ancien incertain exige de consulter Resend et réconcilier son état.
Ne pas supprimer la réservation pour recommencer : cela pourrait créer un doublon.

## Références vérifiées

- https://resend.com/docs/dashboard/receiving/introduction
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://docs.svix.com/receiving/verifying-payloads/how-manual
- https://resend.com/docs/api-reference/emails/retrieve-received-email
- https://resend.com/docs/api-reference/emails/send-email
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://supabase.com/docs/guides/auth/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
