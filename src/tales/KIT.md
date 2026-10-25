# Kit « Crypto stories » (pixel art) : mode d'emploi pour écrire les plans d'une story

Tu écris **uniquement les plans** d'un short narratif crypto en **pixel art** (30–60 s, 1080 × 1920, 30 fps).
Tout le reste est fourni par l'habillage `src/tales/TaleVideo.tsx` et tu n'y touches pas :

- la voix off, les **sous-titres pixel** mot à mot (en bas, lignes 120 à 134) et la musique ; **aucun bruitage** ;
- le **moment produit** (beat `role: "product"`) : un bureau, un écran pixel et la vraie fiche Where'd Gains Go?.
  **Ne dessine rien pendant ce beat** ;
- la carte de fin (« Follow for the next story »), sur la dernière seconde et demie.

À lire avant d'écrire :
1. `src/tales/pixel/PIXEL.md` : les règles de cohérence du pixel art (grille, palette, proportions, animation). Elles priment sur tout.
2. `src/tales/stories/howells.tsx` + `content/tales/howells.json` : l'exemple de référence.

## Principe : simple et cohérent

Une story, c'est **un plan par beat** : un décor plein écran + 1 à 3 personnages + quelques objets + au plus 2 infos (titre,
compteur, étiquette, tampon, écran). Tu **assembles des pièces de la bibliothèque** ; tu ne dessines pas de pixels toi-même
(pas de `Canvas`, sauf pour un objet vraiment absent de la bibliothèque, et alors dans le même style : contour encre, palette `PAL`).

## Contrat du fichier

Écris `src/tales/drafts/<slug>.tsx` :

```tsx
import React from "react";
import { Beat, useBeat, useTale, Sky, City, Street, Person, Prop, Fly, Label, PAL, GROUND } from "../kit";
import type { StoryProps } from "../types";

const Hook: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Sky kind="night" />
      <City />
      <Street />
      <Person look="hacker" x={-10} to={40} dur={b.at("wallet")} />
      <Prop name="laptop" x={60} at={b.at("laptop")} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1"><Hook /></Beat>
    {/* un <Beat> par beat du JSON, sauf le beat "product" */}
  </>
);
```

- **Imports autorisés** : `react`, `remotion` (`useCurrentFrame`…), `../kit`, `../types`.
- **Interdits** (vérifiés par `tale-check`) : `<Audio>`, `<Video>`, `<Img>`, `staticFile`, URLs, `require`, `fetch`, `Math.random`,
  `Date.now`, et tout ce qui casse le pixel art : `blur(`, `rotate(`, `opacity` en fondu, `interpolate` lisse sur un sprite.
- Les ids de `<Beat id>` doivent exister dans le JSON.

## Repères

- **Grille** : 90 colonnes × 160 lignes (1 cellule = 12 px). Toutes les positions et tailles sont **en cellules**.
- **Sol** : `GROUND` = ligne 105. Les personnages et objets posés ont leurs pieds / leur base sur cette ligne.
- **Zones à respecter** :
  - lignes 0–14 : barre du haut de TikTok / Shorts, rien d'important ;
  - lignes 120–160 : sous-titres puis texte de la plateforme, rien d'important ;
  - à droite (colonnes > 73) sous la ligne 58 : boutons like / commentaires, pas d'info importante.
  - Le cœur de l'image : **colonnes 4–73, lignes 15–118**. Utilise toute cette hauteur (titres en haut, scène au sol).
- **Temps** : dans un `<Beat>`, `useCurrentFrame()` part de 0. `const b = useBeat()` donne `b.at("mot")` (frame où le mot est dit ;
  `b.at("mot", 2)` 2e occurrence, `b.at(3)` 4e mot), `b.dur`, `b.end`, `b.beat.text`, `b.beat.visual`. `useTale()` donne `tale` (hook, facts…).
  **Cale chaque apparition, chaque départ de marche, chaque objet qui vole sur le mot qui le nomme.**

## Bibliothèque (`../kit`)

**Décors plein écran** (à mettre en premier dans le plan, dans cet ordre : ciel, puis fond, puis sol)
- `<Sky kind="night|dusk|day|void|office" />` : ciel en bandes tramées (étoiles la nuit, nuages le jour). `void` = noir, pour un plan « écran ».
- `<City kind="night|day" ground? />` : immeubles (fenêtres allumées la nuit).
- `<Street ground? />` : trottoir + rue sous le sol.
- `<Room window="night|day|none" wall? ground? />` : intérieur (mur, parquet, fenêtre).
- `<Hill kind="landfill|grass|sand" height? ground? />` : colline au centre (décharge avec déchets, herbe, sable).

**Personnages** : `<Person look x y? at? to? dur? pose? face? hold? />`
- `look` : `dev`, `hacker`, `suit`, `cop`, `trader`, `teen`, `judge`, `worker`, `founder`, `whale` (ou une tenue `{ shirt, hair, skin, pants, wear }`).
- `x` = colonne des pieds, `y` = ligne du sol (défaut `GROUND`). Avec `to` + `dur` : il **marche** de `x` à `to` (cycle de marche),
  puis prend `pose` : `idle`, `cheer` (bras levé), `point` (montre devant lui), `shrug`, `sit` (avec une `chair`).
- `face="left|right"` (sinon il regarde où il va), `hold` = objet tenu : `drive`, `laptop`, `phone`, `coin`, `bag`.
- Entrer / sortir du cadre : partir de `x={-10}` ou aller à `to={100}`.
- **Personnes réelles** : un rôle neutre et un prénom ou une initiale dans une étiquette, jamais de caricature ni d'accusation.

**Objets** : `<Prop name x y? at? anchor="bottom|center" flip? out? />` (posé sur le sol par défaut ; `anchor="center"` en l'air)
- Tech : `laptop`, `computer`, `desk`, `chair`, `server`, `phone`, `drive`, `chart`
- Crypto : `coin` (BTC), `eth`, `stable` (USDT), `doge`, `wallet`, `key`, `lock`, `chest`, `bag` (sac de $)
- Ville : `bank` (aussi tribunal / mairie), `house`, `car`, `truck`, `bin`, `sign`
- Divers : `pizza`, `doc`, `gavel`, `drone`, `robotdog`, `rocket`, `fire`, `skull`, `bomb`, `crown`
- `<Fly name from={[x,y]} to={[x,y]} at dur? arc? vanish? flip? />` : un objet qui se déplace (pièces qui s'envolent, camion qui passe,
  transfert d'un wallet à l'autre). `arc` = hauteur de la parabole, `vanish` = disparaît à l'arrivée.

**Infos** (texte en polices pixel ; positions en cellules, centrées)
- `<Title text y? at? size? />` : titre en haut (Silkscreen), `*mot*` sur bloc rose. Le beat `hook` affiche `tale.hook` avec `<Title>`.
- `<Counter value x? y at size? color? label? />` : grand nombre qui défile par paliers (« $319,000,000 », « 8,000 BTC »).
- `<Label x y at text color? textColor? size? out? />` : étiquette (date, lieu, nom, rôle). Une date ou un lieu par plan, en haut (y ≈ 16).
- `<Bubble x y at text out? />` : bulle de dialogue (pointe en (x, y), au-dessus d'une tête : y = sol − 36). **Seulement pour une citation
  rapportée par les sources** (sinon une `<Label>`).
- `<Stamp x? y at text color? size? />` : tampon (« DENIED », « HACKED », « FROZEN »), une fois par plan au plus.
- `<Screen x y w h at lines title? color? />` : écran de terminal où le texte se tape (post de forum, message on-chain, code, transaction).
  (x, y) = coin haut gauche.
- `<Chart x y w h at points labels? color? />` : courbe de prix tracée par paliers ; `labels={[{ i, text }]}` sur des points.
- `<Bar x y w at to label? color? dither? />` : jauge (85 % rendus, 15 % gardés…).
- `<Arrow from to at color? />` : flèche en pointillés. `<Pin x y at label? />` : épingle de lieu.

## Style et rythme

- **Un plan = un décor plein écran.** Change de décor quand l'histoire change de lieu ou d'époque ; sinon garde le même et fais bouger la scène.
- **Du mouvement à chaque plan** : quelqu'un marche, un objet vole, un écran se tape, un camion passe. Un changement visible au moins toutes les ~2 s.
- **Lisible sur téléphone** : 1 personnage principal, 3 à 6 éléments à l'écran, les infos en haut, l'action au sol.
- Le hook est fort dès la frame 0 : `Title` + un décor qui pose l'énigme + un premier mouvement.
- Pas de fondu, pas de rotation, pas de flou, pas de zoom lisse : en pixel art tout apparaît, tombe ou se déplace **par paliers**.
- Reste fidèle aux faits du JSON : n'invente ni chiffre, ni citation, ni titre de presse.

## Méthode

1. Lis le JSON (`beats` : texte dit + brief `visual`, `facts`, `sources`, `product.beat`), `PIXEL.md` et l'exemple.
2. Pour chaque beat (sauf product) : choisis le décor, qui agit (marche d'où à où, sur quel mot), quels objets apparaissent ou volent, et au plus 2 infos.
3. Écris le fichier, puis lance `node scripts/tale-check.mjs <slug> --draft` (dernière ligne : JSON `{ ok, errors, stills, sheet }`).
4. Corrige les erreurs, puis **regarde les images** (`sheet`, `stills`, et `--frames=…` pour d'autres instants) : lisibilité, chevauchements,
   zones interdites, cohérence avec la phrase, cohérence avec la référence. Itère (3 passes max), puis termine par un résumé d'une ligne par beat.
