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
- **Tout objet tiré d'une image est détouré** : un PNG à fond transparent, propre, dont le pixeliseur ne garde que l'objet
  (contour d'une cellule autour de lui, pas d'un rectangle). Après chaque `hd-source.mjs`, si l'image montre un objet (bâtiment,
  véhicule, machine, billet posé, jetons, personnage, logo sur fond), détoure-le :
  `node scripts/hd-cutout.mjs public/tales/hd/<slug>/<photo>.jpg public/tales/hd/<slug>/<objet>-cut.png --poly "x,y x,y …"`
  (polygones et `--circle "cx,cy,r"` en px de la source ; vérifie le résultat sur un fond uni), puis note-le dans `sources.json`
  (même licence, « détouré »). Jamais de masque peint à la couleur du mur ni de photo rectangulaire posée telle quelle.
  Seule exception : un décor qui remplit le plan (rue, skyline, façade de nuit), marqué `// plein cadre : <pourquoi>` au-dessus
  de sa ligne. `tale-check` refuse tout JPEG ou WebP sans ce commentaire.
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

## 7. Défauts déjà vus : interdits

Relevés sur des vidéos publiées. Relis cette liste sur chaque image de `tale-check`, en anglais **et** en français
(`--lang=fr`).

- **Un texte, une place.** Jamais deux textes sur la même ligne ou la même zone, ni un texte posé sur un autre ou sur une
  icône. Un état (« MATCH », « ALERT », « OK ») ne s'ajoute pas à côté d'un texte : il le met en valeur (fond qui clignote,
  couleur). Le français est 20 à 40 % plus long : prévois la place du texte traduit, pas celle de l'anglais.
- **Rien par-dessus ce qui doit se lire.** Pas de drapeau, d'icône ou de sticker sur un écran, un bordereau ou une étiquette.
  Un bouton (SEND, OK) reste entier, loin du bord où un autre objet le couperait (rouleau de machine, cadre, sol).
- **Photo détourée = vraie transparence.** Un JPEG garde son fond (feutre, mur, ciel) : détoure-le avec des polygones
  (`polys`) ou un PNG à canal alpha (`ffmpeg … geq … a=…`), jamais en repeignant des cellules de la couleur du mur. Pas de
  fondu « qui se dissout dans le mur » non plus : sur un fond éclairé ou tramé, il laisse un rectangle gris.
- **Pas de décor parasite.** Une photo de bâtiment derrière l'objet héros (un coffre, une machine) se lit comme autre chose
  (« un château »). Chaque élément sert la phrase ; pas de gyrophares ou d'ampoules symétriques en bord de cadre.
- **À l'échelle de la photo.** Un objet dessiné posé sur une photo (porte, enseigne) garde l'échelle de la scène : une porte
  de banque plus grande que les voitures d'à côté ne marche pas. Sinon, une étiquette (`Label`) sous la photo suffit.
- **Un objet réel garde sa logique.** Pas de bouton SEND sur un ordre papier, pas d'interface sur un objet qui n'en a pas.
- **Un bâtiment se lit à sa forme.** Si la vraie photo trompe (la Fed de New York, un palais florentin, se lit « château »),
  dessine la forme que tout le monde reconnaît (banque à colonnes et fronton) et nomme-la avec une étiquette.
- **Montrer l'état, pas un ballet.** « L'argent ne part jamais » = le coffre ouvert, l'argent intact dedans ; « une banque
  repère la faute et pose des questions » = la requête elle-même, lisible (destinataire, objet). Pas d'objets anonymes qui volent
  dans un coffre, pas de gyrophare posé sur un objet pour dire « alerte » (un bandeau ALERT sur le document suffit).
- **Pas de mains ni de bras qui manipulent.** Mal dessinés, ils gâchent le plan : les machines s'animent seules (la touche
  frappée s'enfonce, le bouton s'allume, le papier sort).
- **Pas de traits fins qui traversent.** Câbles, fils, trajets en pointillé qui passent sur un personnage ou un objet : à
  retirer. Un déplacement se montre par un objet qui bouge, pas par une ligne.
- **La boucle.** Le dernier plan (`loop`) montre le décor du hook **en plein cadre dès qu'il revient**, pas une miniature qui
  grossit en fin de vidéo, et rien de nouveau dans la dernière seconde : la vidéo enchaîne sur la frame 0 du hook. Côté
  voix, l'outro est générée en sachant qu'elle enchaîne sur le hook, et coupée sur le dernier mot (`scripts/gen-voice.mjs` →
  `trimTail`), sans queue de fin (`shared/tales.mjs` → `TALE_TAIL = 0`).
