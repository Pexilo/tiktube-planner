# Direction pixel art des stories : règles de cohérence (grille historique)

> Stories historiques sur la grille 90 × 160 (`"../kit"`). Les nouvelles stories suivent le style HD : `src/tales/hd/HD.md`.

À lire avant de dessiner ou d'animer quoi que ce soit en pixel art pour une story. Une vidéo réussie, c'est
**un seul univers** : même grille, même palette, mêmes proportions, du premier au dernier plan.
Notes tirées de Sprite Fusion (générateur pixel art pour jeux), adaptées à notre moteur `src/tales/pixel/`.

## 1. Une seule grille, taille native

- Tout est dessiné **à la vraie taille en pixels** puis affiché à **une seule échelle entière** : `P = 12` px à l'écran
  par pixel (grille de 90 × 160 pour l'image 1080 × 1920). Une seule exception, réglée : le **demi-pixel de 6 px**, réservé
  au texte courant et aux icônes fines (`px-…`), toujours calé sur la même grille. Aucune autre taille de pixel
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

- Les **planches de référence** (`proto-index.tsx` : `pixel-sheet` le casting, `pixel-props` les objets du monde à côté d’un personnage,
  `pixel-icons` les icônes, `pixel-fine` les icônes fines, `pixel-light` les lumières) sont la référence : palette, proportions,
  contour et ombrage. Tout nouveau sprite (personnage, objet, décor) doit avoir l'air de sortir de la même main.
- Avant de valider un nouveau sprite, compare-le à la référence côte à côte, à la même échelle.
- Garde une petite référence (4 à 8 sprites) : au-delà, on dilue le style.

## 4. Tailles et proportions fixes

- **Une échelle unique** : un personnage = **20 pixels ≈ 1,70 m**, donc 1 pixel ≈ 8,5 cm. Tout objet du monde est dessiné à
  ses dimensions réelles à cette échelle (poubelle ≈ 1 m = 12 px, voiture 1,5 m de haut = 15 px, maison à étage ≈ 44 px,
  bureau 0,75 m = 9 px). Les petits objets réels restent petits (un disque dur en main = 3 × 2 px).
- **Les symboles sont à part** : une pièce, une clé, un cadenas, un wallet en l'air ou en gros plan sont des *icônes*
  (7 à 18 px), lisibles seules. On ne pose jamais une icône au sol à côté d'un personnage comme si c'était un objet réel.
- **Icônes fines** (`px-…`, 24 × 24 demi-pixels = 12 cellules) : bitmaps de pixelarticons (MIT), coloriés automatiquement
  (traits foncés, intérieur à la couleur, reflet en haut à gauche, ombre en bas à droite, contour encre d'une cellule).
  Pour en ajouter : `scripts/build-fine-icons.mjs` (liste `PICKS`), jamais de bitmap recopié à la main.
- Personnages **simples**, tous du même gabarit (12 × 20, de profil, pieds sur la même ligne) : tête ronde, un œil, bloc de
  vêtements, jambes de 2 pixels. Le rôle se lit à la couleur et à un seul accessoire (capuche, casquette, cravate, lunettes,
  bonnet, coupe). Pas de visage détaillé, pas de bras dessinés à la main.
- Sprites fond transparent, posés sur le sol (pas de flottement, sauf les icônes et ce qui vole).

## 4 bis. Fonds minimalistes, éclairés

- Un plan = **un aplat** de la palette Where'd Gains Go? (encre, encre profonde, papier, rose, lime, cyan) + un sol d'un ton voisin.
  Pas de ciel détaillé, de ville éclairée, de pièce meublée ni de texture : ça se voit vite « à côté » du reste.
- Le volume vient de la **lumière** (`light` du `<Beat>` : halo, cône, plafond) : une rampe de 5 tons de la couleur du fond,
  passée en **tramage ordonné** (Bayer 4 × 4) sur la grille, jamais en dégradé lisse ; le halo respire par paliers.
  Particules (`ambient`) : 1 pixel, peu nombreuses, dans la lumière.
- Au plus un élément de contexte, en aplat d'un ton voisin du fond (tas, silhouette de ville). Le vide est voulu.
- 3 couleurs de fond au plus par vidéo, choisies pour l'émotion du moment (rose = choc, lime = gain, cyan = institution…).

## 5. Contours et ombrage

- Contour **1 pixel encre** autour des personnages et des objets (automatique : `Canvas.outline()`), de la même couleur partout.
- Les éléments de contexte (tas, silhouette) n'ont qu'un ton, proche du fond : le sujet se détache par contraste.
  Sur un fond encre, les personnages se lisent par leurs couleurs vives (le contour encre se fond, c'est voulu).

## 6. Animation

- Les animations partent du **même sprite de base** : seuls les membres bougent (marionnette), le reste des pixels est identique.
- Peu d'images, timing en paliers : la marche fait un cycle de 8 poses, une pose tient 2 à 4 frames vidéo.
  Pas de mouvement lisse interpolé sur les sprites (seule la caméra peut glisser, et toujours calée sur la grille).
- Direction : de profil pour marcher (gauche = miroir de droite), de face pour attendre ou réagir.

## 7. Texte

- **Une seule police : la police bitmap du kit** (`font.tsx`, lettres de 5 × 7 pixels), dessinée sur la grille : pixels de 6 px
  pour le texte courant (moitié d'une cellule), 12 px pour les titres, compteurs et tampons, 9 px pour les sous-titres (habillage). Aucune police système :
  un caractère absent tomberait sur une police lisse qui casse le pixel art (c'était le cas de `→` et `≈`). Il en manque un ? On
  l'ajoute dans `font.tsx`, on ne le contourne pas.
- Cadres, bordures et ombres au même pas : bordure de 1 pixel, ombre de 1 pixel décalée en bas à droite, jamais d'épaisseur libre.
- Ombres de texte dures et décalées d'un multiple de pixel, jamais floues.

## 8. Décrire un sprite (pour soi ou un générateur)

- Décrire **ce qu'il faut dessiner**, pas le style : le style vient de la référence.
- Rester neutre : des mots comme « géant », « épique », « réaliste » écrasent le style de référence.
- Rappeler explicitement un trait de style quand il risque de se perdre (« contour encre 1 px », « 4 couleurs max »).

## Outils externes (facultatifs, non branchés)

- Sprite Fusion (API payante) génère des sprites « dans le même style », en 8 directions, et les anime à partir d'un sprite.
- Pixel Snapper (open source) remet sur la grille et verrouille sur une palette une image pixel art floue ou décalée :
  utile seulement si on importe un jour des images externes.

## Miniature

- Une par story, rendue après la vidéo (`src/tales/TaleThumb.tsx`, composition `<id>-thumb`, 1080 × 1920) : un plan figé de la
  story (le hook par défaut, autre phrase au choix dans le dashboard) sous un en-tête encre avec le titre, en lettres de 12 px.
- Mêmes règles que la vidéo : grille, palette, police bitmap ; le premier mot chiffré du titre passe en bloc rose.
- Le titre n'a ni emoji ni hashtag (la police n'en a pas, et les plateformes n'en veulent pas dans le titre).
