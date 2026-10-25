# Direction pixel art des stories : règles de cohérence

À lire avant de dessiner ou d'animer quoi que ce soit en pixel art pour une story. Une vidéo réussie, c'est
**un seul univers** : même grille, même palette, mêmes proportions, du premier au dernier plan.
Notes tirées de Sprite Fusion (générateur pixel art pour jeux), adaptées à notre moteur `src/tales/pixel/`.

## 1. Une seule grille, taille native

- Tout est dessiné **à la vraie taille en pixels** puis affiché à **une seule échelle entière** : `P = 12` px à l'écran
  par pixel (grille de 90 × 160 pour l'image 1080 × 1920). Jamais deux tailles de pixel dans la même image
  (c'est le défaut n° 1 du pixel art raté, les « mixels »), jamais d'échelle non entière.
- Positions et déplacements **calés sur la grille** (`snap`) : un objet bouge d'un pixel entier, jamais d'un demi-pixel.
- Pas de flou, pas d'anticrénelage, pas d'ombre floutée, pas de dégradé lisse : les transitions se font par **trame**
  (dithering : damier entre deux couleurs) ou par paliers.

## 2. Une palette fixe pour toute la série

- Uniquement les couleurs de `PAL` (`engine.tsx`), dérivées de Where'd Gains Go? : encre, papier, rose, lime, cyan, orange,
  plus les teintes de peau, de cheveux et les gris. **Aucune couleur hors palette**, même pour un détail.
- Ombres et volumes en **rampes de 2 à 3 tons** de la même couleur (la fonction `shade`), lumière qui vient d'en haut à gauche.
- Peu de couleurs par objet (3 à 5) : la lisibilité vient des silhouettes, pas des détails.

## 3. Une référence de style

- La **planche des personnages** (`proto-index.tsx`, composition `pixel-sheet`) est la référence : palette, proportions,
  contour et ombrage. Tout nouveau sprite (personnage, objet, décor) doit avoir l'air de sortir de la même main.
- Avant de valider un nouveau sprite, compare-le à la référence côte à côte, à la même échelle.
- Garde une petite référence (4 à 8 sprites) : au-delà, on dilue le style.

## 4. Tailles et proportions fixes

- Personnages : **une seule taille de silhouette pour tout le casting** (≈ 34 px de haut, pieds sur la même ligne de base),
  silhouette lisible en aplat noir. Le rôle se lit à un accessoire (capuche, casquette, cravate, lunettes, bonnet, objet tenu).
- Objets : classes de taille fixes (≈ 16, 24 ou 32 px de large). Icônes : 16 × 16.
- Sprites **centrés**, fond transparent, posés sur le sol (pas de flottement sauf intention).

## 5. Contours et ombrage

- Contour **1 pixel encre** autour des personnages et des objets (automatique : `Canvas.outline()`), de la même couleur partout.
- Les décors lointains (ciel, ville) n'ont pas de contour et sont plus sombres et moins saturés que les personnages :
  le sujet se détache par contraste. Jamais un personnage à contour encre sur un fond noir uni.

## 6. Animation

- Les animations partent du **même sprite de base** : seuls les membres bougent (marionnette), le reste des pixels est identique.
- Peu d'images, timing en paliers : la marche fait un cycle de 8 poses, une pose tient 2 à 4 frames vidéo.
  Pas de mouvement lisse interpolé sur les sprites (seule la caméra peut glisser, et toujours calée sur la grille).
- Direction : de profil pour marcher (gauche = miroir de droite), de face pour attendre ou réagir.

## 7. Texte

- Polices pixel uniquement : **Silkscreen** (titres), **Pixelify Sans** (sous-titres et texte), **VT323** (écrans, terminal).
- Ombres de texte dures et décalées d'un multiple de pixel, jamais floues.

## 8. Décrire un sprite (pour soi ou un générateur)

- Décrire **ce qu'il faut dessiner**, pas le style : le style vient de la référence.
- Rester neutre : des mots comme « géant », « épique », « réaliste » écrasent le style de référence.
- Rappeler explicitement un trait de style quand il risque de se perdre (« contour encre 1 px », « 4 couleurs max »).

## Outils externes (facultatifs, non branchés)

- Sprite Fusion (API payante) génère des sprites « dans le même style », en 8 directions, et les anime à partir d'un sprite.
- Pixel Snapper (open source) remet sur la grille et verrouille sur une palette une image pixel art floue ou décalée :
  utile seulement si on importe un jour des images externes.
