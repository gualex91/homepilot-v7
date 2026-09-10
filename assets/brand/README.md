# Identité visuelle Nuvabri — v1

Identité approuvée dans la conversation du projet : monogramme N évoquant un abri, vert profond et ivoire. Le nom reste lisible en texte natif à côté du symbole, y compris lorsque les images sont désactivées.

Signature : **Vos biens. Vos projets. L’esprit tranquille.**

## Fichiers

- `nuvabri-brand-board-v1.png` : planche de référence (1536 × 1024), non chargée par l’application.
- `nuvabri-icon-master-v1.png` : icône originale approuvée (1254 × 1254), conservée sans retouche.
- `nuvabri-icon-32-v1.png` : favicon.
- `nuvabri-icon-96-v1.png` : logo affiché dans l’application.
- `nuvabri-icon-180-v1.png` : Apple Touch Icon.
- `nuvabri-icon-192-v1.png` : écran haute densité et manifeste.
- `nuvabri-icon-512-v1.png` : manifeste, usages standard et maskable.

Les déclinaisons sont des exports techniques du même original, sans nouveau dessin. Le symbole reste dans la zone de sécurité circulaire de l’icône. Les angles extérieurs des fichiers restent carrés; la plateforme applique son propre masque.

## Couleurs

| Rôle | Couleur |
| --- | --- |
| Marque principale | `#173F3A` |
| Vert secondaire | `#356F68` |
| Ivoire | `#F6F2E8` |
| Sauge | `#92B4A0` |
| Terre cuite | `#C77D5C` |

Les variables `--nuvabri-*` et les styles du logo sont dans `/nuvabri-brand.css`. Le monogramme, le nom, les boutons principaux de connexion et la barre du navigateur utilisent la marque stable. Les autres couleurs et fonds botaniques conservent leur fonctionnement saisonnier existant. Aucun changement d’icône à chaque saison.

## Origine et reproduction

Création avec l’outil de génération d’images intégré : planche d’identité « Nuvabri », monogramme N/abri, couleurs ci-dessus, signature française et quatre accents saisonniers. La version retenue corrige le contraste sur ivoire et impose le même monogramme complet dans chaque déclinaison. L’icône a ensuite été isolée sur un carré vert avec de grandes marges. Les deux images originales retenues sont conservées ici.

Pour reproduire les exports sans toucher aux originaux (ImageMagick) :

```sh
for size in 32 96 180 192 512; do
  convert nuvabri-icon-master-v1.png -resize "${size}x${size}" -strip "nuvabri-icon-${size}-v1.png"
done
```

La planche est un concept raster, pas un fichier vectoriel ni une police de caractères fournie. Le mot-symbole dans l’application utilise la pile système arrondie, sans police externe ni demande réseau supplémentaire.

## Intégration et vérification

Les trois points d’entrée (`index.html`, `seasonal-shell.html`, `app-core.html`) déclarent le manifeste et les icônes, car le shell remplace le document pendant le chargement. Le manifeste conserve le `start_url` d’origine. Aucun service worker ni mode hors ligne n’est ajouté.

Références : [icônes de manifeste MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons), [critères d’installation Chrome](https://web.dev/articles/install-criteria).

Vérifications : dimensions PNG déclarées identiques aux fichiers exportés; points d’entrée synchronisés; JavaScript des scripts intégrés valide; 31 tests existants réussis (connexion/récupération, navigation/DIY, accès administrateur). L’affichage de l’icône après ajout à l’écran d’accueil doit encore être vérifié sur un appareil réel.
