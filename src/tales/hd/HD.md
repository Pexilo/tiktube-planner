# Direction pixel art HD des stories

Le style des nouvelles stories. Même univers que `../pixel/PIXEL.md` (palette Where'd Gains Go?, lumière tramée, police
bitmap), mais deux fois plus de pixels et des objets tirés d'images réelles, à la manière d'Archibald. Code : `src/tales/hd/`
(importé par les stories depuis `"../hd"`), mode d'emploi : `../KIT.md`, exemple : `../stories/pizza.tsx`.
Un plan HD s'écrit `<Beat id scene={…}>` : le plateau (décor, lumière, air, caméra) est posé par le Beat.
Planche de référence : `node scripts/hd-stills.mjs` → `out/hd/` (plans, planche, zooms ×2 pour juger le pixel).

## 1. Grille

- 180 × 320 cellules de 6 px (`grid.ts`). Une seule taille de pixel pour les objets et les personnages ; le texte
  bitmap du kit tombe pile dessus (lettre = 5 × 7 cellules, × 2 pour titres et sous-titres).
- Plus d'icônes de bibliothèque (pixelarticons, icônes de 7 à 18 px) : trop pauvres à cette densité. Un objet est une
  source pixelisée ou un dessin en cellules.

## 2. Palette

- `palette.ts` : chaque couleur WGG devient une rampe de 5 à 8 tons (OKLab) ; les ombres glissent vers l'encre bleutée,
  les lumières vers le papier chaud. `tomato` (mi-rose mi-orange) pour la sauce et le pepperoni, `wood` pour le bois.
- Tout est verrouillé sur ces tons. Chaque sprite déclare ses rampes (`ramps`) : un objet neutre n'a pas droit à
  l'orange, sinon la trame sème des pixels parasites.

## 3. Objets : vraie image → pixel art (`pixelize.tsx`)

- `<Pix src w …>` prend n'importe quelle image (photo, logo, capture, SVG), la réduit à `w` cellules, la retouche
  (`contrast`, `sat`), la quantifie en trame de Bayer, retire les pixels isolés, éclaircit le bord haut-gauche, assombrit
  le bas-droit et pose un contour d'une cellule (ton le plus sombre de la rampe voisine).
- Photos, matières, dégradés : moyenne + trame (`dither` 0,35 à 0,6). Aplats imprimés, logos, lettrage sur un objet :
  `mode` (couleur majoritaire, bords nets, pas de bouillie tramée).
- Sources : images libres dans `public/tales/hd/<slug>/`, récupérées avec `node scripts/hd-source.mjs` (licence notée dans
  `sources.json`), ou SVG dessinés (`sources.ts`, ou dans la story). Une source se remplace sans toucher au plan.
- Le petit texte d'une capture devient illisible : seuls les gros chiffres et les blocs de couleur survivent. Ce qui
  doit se lire passe en texte bitmap (`Txt`, `forumPost`).

## 4. Personnages et accessoires en cellules (`people.ts`, `draw.ts`)

- Marionnettes d'environ 60 cellules (≈ 1,60 m), grosse tête lisible, profil vers la droite ; poses `stand`, `walk`,
  `type` (assis au clavier), `phone`. Le rôle se lit aux couleurs et à un accessoire (lunettes, casquette).
- Une seule règle d'ombrage (`part`) : bord haut-gauche +1 ton, bande bas-droite −1 ton, trait sombre contre ce que la
  pièce recouvre. Tout le casting sort ainsi de la même main.

## 5. Lumière, air, caméra (`stage.tsx`)

- `<Stage scene>` : mur (marbrure légère) et sol, puis une carte d'éclairage multipliée sur tout le plan, décor et
  objets compris, en 9 paliers tramés : projecteur `cone`, halo `glow`, jour `top`. Ce qui sort de la lumière tombe
  dans l'ombre. La carte reste fixe pendant un plan ; seul le faisceau respire par paliers.
- L'air : faisceau visible qui pâlit vers le sol (il ne voile pas les objets), poussière d'une cellule qui ne brille
  que dans la lumière.
- `Reflect` (sol brillant, reflet estompé par bandes), `Glow` (écrans, néons), `Steam` (vapeur en rubans tramés).
- La caméra : vignette, grain, lignes de balayage. C'est la seule couche douce, elle ne touche pas au dessin.
- Poids de la vidéo : tout ce qui change sur tout l'écran à chaque image (grain qui défile, trame qui respire) la rend dix
  fois plus lourde. Grain figé, carte d'éclairage fixe : ce qui bouge, ce sont les objets, la poussière et le faisceau.
- Les textes du récit passent au-dessus de la lumière : jamais assombris. Un texte posé sur le décor (prix d'une courbe,
  étiquette d'un objet, écran) est du décor (`layer="world"`) : éclairé comme lui, et un personnage passe devant.
- Sons d'animation : des bruitages physiques doux (carton, papier, bois, métal, verre), jamais de bip ni d'arpège 8-bit
  (`scripts/gen-tale-sfx.mjs`).

## 6. Composition

- Un sujet héros, grand, dans la lumière ; le reste dans l'ombre. Encre pour le suspense, papier pour les documents,
  au plus 3 fonds par vidéo.
- Sous-titres sous la ligne 246 (`CAPTION_ROW`) : rien d'essentiel en dessous.
