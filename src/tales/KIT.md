# Kit « Crypto stories » HD : mode d'emploi pour écrire les plans d'une story

Tu écris **uniquement les plans** d'un short narratif crypto en **pixel art HD** (1 à 2 minutes, 10 à 18 plans, 1080 × 1920,
30 fps), avec le kit `src/tales/hd` (importé depuis `"../hd"`). Tout le reste est fourni par l'habillage `src/tales/TaleVideo.tsx` :

- la voix off, les **sous-titres pixel** mot à mot (en bas, à partir de la ligne 246) et les **bruitages narratifs** du script
  (`beat.sfx`, calés sur un mot). **Pas de musique** ;
- les **sons d'animation** : les composants qui apparaissent jouent leur petit son (voir « Sons ») ;
- le **moment produit** (beat `role: "product"`) : le moniteur 2010 du kit avec la vraie fiche Where'd Gains Go? dedans.
  **Ne dessine rien pendant ce beat** ;
- **pas de carte de fin : la vidéo boucle** (dernier beat `<Beat id="bN" loop>`, voir « La boucle »).

À lire avant d'écrire :
1. `src/tales/hd/HD.md` : les règles du style HD (grille, palette, sources, lumière). Elles priment sur tout.
2. `src/tales/stories/pizza.tsx` + `content/tales/pizza.json` : l'exemple de référence (qualité et densité attendues).
Les stories de l'ancienne grille (90 × 160, `"../kit"`) suivent `src/tales/pixel/KIT.md` ; n'en écris plus de nouvelles.

## Principe : une image réelle, une lumière, un mouvement

Un plan = un **plateau** (`<Beat scene>` : mur et sol de la palette, lampes) + **un sujet héros** grand et dans la lumière
(un objet pixelisé, un personnage qui agit, un écran, une courbe) + **2 à 4 détails qui vivent** (vapeur, pièces qui sautent,
poussière dans le faisceau, curseur qui clignote) + au plus 2 infos (titre, étiquette, tampon, compteur, message de forum).

- **Les objets sont des sources pixelisées** (`<Pix src>`) : une vraie image de `public/tales/hd/` (photo, logo, capture,
  sourcée avec sa licence, voir « Sources ») ou un SVG dessiné grand avec ses matières (`svgUrl`). Le pixeliseur les verrouille sur
  la palette : c'est ce qui donne l'aspect « vraie chose devenue pixel art ». Plus d'icônes de bibliothèque.
- **Les personnages et accessoires simples** (bureau, chaise, étiquette, post-it, tasse) sont dessinés en cellules par le kit.
- Ce qui doit **se lire** (dates, prix, citations) est en texte bitmap (`Txt`, `Label`, `Card`), jamais dans une source pixelisée.

## Contrat du fichier

```tsx
import React from "react";
import { Beat, Card, Drop, GROUND, Label, Person, Pix, Steam, Title, tone, useBeat, useTale } from "../hd";
import type { Look, Scene } from "../hd";
import type { StoryProps } from "../types";

const SPOT: Scene = { wall: tone("ink", 5), floor: tone("ink", 6), ambient: 0.2, lamps: [{ kind: "cone", x: 90, beam: 0.55 }], dust: 90 };

const Hook: React.FC = () => {
  const b = useBeat();
  const { tale } = useTale();
  return (
    <>
      <Title text={tale.hook} y={58} />
      <Pix src={MY_OBJECT} w={128} x={90} y={GROUND} />
      <Label text="10,000 BTC" x={90} y={226} color={tone("orange", 3)} at={b.at("thousand")} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1" scene={SPOT}><Hook /></Beat>
    {/* un <Beat scene> par beat du JSON, sauf le beat "product" ; le dernier : <Beat id="bN" loop> */}
  </>
);
```

- **Imports autorisés** : `react`, `remotion` (`useCurrentFrame`…), `../hd`, `../types`. Jamais `../kit` dans une story HD.
- **Interdits** (vérifiés par `tale-check`) : `<Audio>`, `<Video>`, `<Img>`, `staticFile`, URL, `require`, `fetch`,
  `Math.random`, `Date.now`, `blur(`, `filter:`. Une vraie image = un chemin `"tales/hd/…"` donné à `<Pix src>`.
- Les ids de `<Beat id>` doivent exister dans le JSON.

## Repères (grille HD)

- **180 colonnes × 320 lignes** (1 cellule = 6 px). Toutes les positions et tailles sont en cellules. `P` = 6.
- **Sol** : `GROUND` = ligne 210 (un plateau peut le déplacer : `ground`). Objets et personnages ont leur base sur cette ligne.
- **Zones** : rien d'important au-dessus de la ligne 54 (barre de la plateforme) ni sous la ligne 242 (sous-titres puis légende) ;
  colonnes 10 à 160 pour les textes (à droite, les boutons). Le cœur de l'image : **colonnes 10–160, lignes 54–242**.
  Un garde-fou décale tout texte qui en touche un autre ou sort de ces lignes : un décalage est le signe d'un plan trop chargé.
- **Temps** : dans un `<Beat>`, `useCurrentFrame()` part de 0. `const b = useBeat()` : `b.at("mot")` (frame où le mot est dit,
  `b.at("mot", 2)` 2e occurrence), `b.dur`, `b.end`. `useTale()` : `tale` (hook, facts…). **Cale chaque apparition, chaque marche,
  chaque objet qui tombe sur le mot qui le nomme.** `STILL` (-30) = déjà en place à la coupe, sans son.

## Plateaux (`<Beat scene>`)

`Scene` = `{ wall, floor?, ground?, ambient?, lamps, shadow?, dust?, dustColor?, mottle?, seed? }`, couleurs prises avec
`tone(rampe, ton)` (rampes : `ink`, `stone` (gris → papier), `pink`, `tomato`, `orange`, `lime`, `cyan`, `skin`, `hair`, `wood`).

- `lamps` : `{ kind: "cone", x, top?, spread?, core?, power?, beam? }` (projecteur : cône, flaque au sol, faisceau visible),
  `{ kind: "glow", x, y, r, power? }` (halo : écran, lampe), `{ kind: "top", power? }` (jour diffus).
- `ambient` : lumière hors des lampes (0,1 = nuit, 0,2 = suspense, 0,5 = intérieur clair). Tout ce qui sort de la lumière, objets
  compris, tombe dans l'ombre : place le sujet dans le faisceau.
- `floor: false` : pas de sol (un objet flotte dans le noir). `dust` : particules qui ne brillent que dans la lumière.
- Encre + projecteur = suspense, papier + lampe = documents et intérieurs, lime = gain et courbes, au plus 3 familles par vidéo.

## Bibliothèque (`../hd`)

**Objets pixelisés**
- `<Pix src w x y anchor? ramps? mode? dither? contrast? sat? crop? outline? rim? />` : `w` cellules de large, ancré au milieu du
  bas (`anchor="center" | "topleft"`). **Toujours `ramps`** (les tons permis : `["stone", "ink"]` pour un objet neutre, etc.).
  `mode` pour les aplats imprimés et les logos (bords nets), `dither` 0,35–0,6 pour les photos et dégradés.
- Sources prêtes : `pizzaBoxClosed()`, `pizzaBoxOpen()`, `pizzaSlice()`, `coinHero()` (pièce ₿), `coinStacks()`, `crtMonitor()`
  (+ `CRT.screen` : zone de l'écran), `cashRegister()` (+ `REGISTER.display`), `deliveryCar()`, `fork()`.
- **Nouvel objet** : `const ATM = svgUrl(\`<defs>${lin(…)}</defs><rect …/>\`, 300, 200)`, dessiné grand (200 à 400 unités), lumière en
  haut à gauche, couleurs `tone(…)`, dégradés `lin` / `rad`, matières (bruit `feTurbulence`) ; pas de texte fin. Ou une vraie image.

**Dessin en cellules**
- `<Cells draw={() => canvas} x y anchor? outline? />` : un `Canvas` du kit (`rect`, `circle`, `limb`, `rows`, `line`, `set`),
  ancré par son origine. `part(c, (m) => m.rect(…), rampe, ton)` peint une pièce ombrée (bord haut-gauche éclairci, bas-droit
  assombri, trait sombre contre ce qu'elle recouvre).
- Accessoires : `desk(w, h)`, `chair()`, `keyboard(w)`, `mug(rampe)`, `priceTag(lignes)`, `stickyNote(lignes, rampe, w, h)`,
  `screenPage(w, h)` (page d'écran simulée), `bunting(w)` (fanions), `forumPost({…})`.

**Personnages**
- `<Person look x y? pose? at? out? to? dur? face? />` : ~60 cellules de haut, de profil. `look` = `{ shirt, pants, pantsStep?,
  hair?, glasses?, cap?, sleeves? }` (rampes). Poses : `stand`, `walk` (avec `to` et `dur` : il marche de x à to), `type` (assis,
  il tape : à poser avec `chair()` et `desk()`), `phone`. Pour changer de pose en cours de plan : deux `Person` avec `out` / `at`.

**Calques** : décor et objets, puis personnages (dans l'ordre du code : ce qui est écrit après passe devant), puis la lumière,
puis les textes du récit, au-dessus de tout. Un texte **posé sur le décor** (prix sur une courbe, étiquette d'un objet, texte d'un
écran) appartient au décor : `layer="world"` (sur `Label` ou `Txt`), écrit avant le personnage qui doit passer devant. Un texte du
récit (titre, date, lieu, tampon, compteur, message) ne croise jamais un personnage : place-le au-dessus de sa tête ou ailleurs.

**Textes** (calque au-dessus de la lumière ; sans `color`, ils s'adaptent au fond)
- `<Title text y k? />` : le hook, lettres de 12 px, `*mots*` surlignés dans un bloc rose.
- `<Label text x y color? ink? at? out? layer? />` : étiquette (date, lieu, prix, nom), tombe en place avec un son.
- `<Stamp text x y at color? />` : gros tampon (lettres de 12 px).
- `<Counter from to at dur x y log? format? box? />` : compteur qui défile (`log` pour 41 → 1,1 milliard).
- `<Card title author date body y at? typeAt? />` : message de forum qui s'écrit (curseur, bruit de frappe).
- `<Txt text x y k? color? box? align? max? chars? layer? />` : texte libre ; `layer="world"` pour un texte du décor (écran).

**Mouvement** (tout avance par paliers : jamais de glissé lisse sur un sprite)
- `<Show at out>`, `<Drop at from sound>` (tombe et se pose), `<Move at dur dx dy arc ease>` (trajet par paliers de 2 frames),
  `<Blink at every>`.
- `<Steam x y cols rise />` (vapeur), `<Glow>` (halo d'un écran, d'un objet qui brille), `<Reflect>` (reflet au sol brillant :
  passe-lui les mêmes éléments que le plan). Ne mets **jamais de texte** dans `Glow` ou `Reflect`.

## Sources (vraies images)

- Pour chaque objet réel et reconnaissable (logo, appareil, bâtiment, document célèbre), **cherche d'abord une image libre** :
  `node scripts/hd-source.mjs <slug> --search "…"` (candidats avec leur licence), puis
  `node scripts/hd-source.mjs <slug> "<titre de fichier Wikimedia Commons>"` (copie dans `public/tales/hd/<slug>/` + `sources.json` :
  auteur, licence, lien). Un SVG dessiné sert pour les objets génériques ou quand rien de libre ne convient.
  Seulement des images libres (domaine public, CC0, CC BY, CC BY-SA) ; jamais d'image prise ailleurs.
- Dans la story : `<Pix src="tales/hd/<slug>/<fichier>" w={…} ramps={[…]} />`. Fond transparent de préférence (PNG, SVG) ; sinon
  `crop` pour isoler l'objet.

## Sons

`Label`, `Drop` (pop par défaut), `Stamp` (tampon), `Counter` (défilement), `Card` (pop, puis frappe) sonnent tout seuls quand ils
apparaissent pendant le plan (pas à la coupe). Ce sont des bruitages physiques doux (carton, papier, bois, métal, verre) : choisis
celui qui ressemble à l'objet (`a-coin` pour une vraie pièce, `a-thud` pour ce qui se pose, `a-blip` pour un petit détail).
Pour un mouvement fait à la main : `<Sound name="a-swish" at={b.at("mot")} />`
(noms : `a-pop`, `a-thud`, `a-blip`, `a-stamp`, `a-count`, `a-coin`, `a-swish`, `a-type`, `a-rise`, `a-ping`, `a-twinkle`,
`a-tick`). Un son par mouvement important, jamais en rafale. Les bruitages narratifs viennent du script : n'en ajoute pas.

## La boucle (dernier beat)

- `<Beat id="bN" loop>` sans `scene` : il reprend le plateau du premier beat (lumière et poussière calées pour que sa dernière frame
  précède la frame 0). Juste après le dernier mot, le kit affiche la frame 0 du premier plan jusqu'à la fin.
- Compose-le sous la même lumière que le hook (même projecteur, sujet au même endroit) pour que la coupure soit douce.
- `tale-check` produit `loop-end.png` et `loop-start.png` : les deux images doivent être identiques.

## Style et rythme

- Un sujet héros par plan, grand, dans la lumière ; le reste dans l'ombre. Le vide est voulu.
- Du mouvement à chaque plan (un changement visible toutes les ~2 s) ; alterne plans avec personnage (une action) et plans d'objet
  ou de courbe (une idée) ; pas plus de 2 plans d'affilée avec le même personnage.
- Le hook est fort dès la frame 0 (c'est aussi la miniature) : `Title` + un objet qui pose l'énigme + un premier mouvement.
- Fils rouges : réutilise un objet d'un plan à l'autre (la même boîte, le même moniteur, la même courbe qui grandit).
- Reste fidèle aux faits du JSON : n'invente ni chiffre, ni citation, ni titre de presse.

## Méthode

1. Lis le JSON (`beats` : texte dit + brief `visual`, `facts`, `sources`, `product.beat`), `hd/HD.md` et l'exemple.
2. Pour chaque beat (sauf product) : le plateau et ses lampes, le sujet héros (source pixelisée, personnage, écran, courbe), les
   détails qui vivent et au plus 2 infos, chacun calé sur un mot.
3. Écris le fichier, puis lance `node scripts/tale-check.mjs <slug> --draft` (dernière ligne : JSON `{ ok, errors, stills, sheet }`).
4. Corrige, puis **regarde les images** (`sheet`, `stills`, `--frames=…`) : lisibilité, sujet dans la lumière, chevauchements, zones,
   cohérence avec la phrase et avec l'exemple. Itère (3 passes max), puis termine par un résumé d'une ligne par beat.
