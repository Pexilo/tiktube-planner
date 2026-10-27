# Kit « Crypto stories » (pixel art) : mode d'emploi pour écrire les plans d'une story

Tu écris **uniquement les plans** d'un short narratif crypto en **pixel art** (1 à 2 minutes, 10 à 18 plans, 1080 × 1920, 30 fps).
Tout le reste est fourni par l'habillage `src/tales/TaleVideo.tsx` et tu n'y touches pas :

- la voix off, les **sous-titres pixel** mot à mot (en bas, lignes 120 à 134) et les **bruitages narratifs** choisis par le script
  (`beat.sfx` : boum, montée, nappe de tension… calés sur un mot). **Pas de musique** ;
- les **sons d'animation** : chaque composant du kit joue déjà son petit son quand il apparaît (voir « Sons ») ;
- le **moment produit** (beat `role: "product"`) : un bureau, un écran pixel et la vraie fiche Where'd Gains Go?.
  **Ne dessine rien pendant ce beat** ;
- **pas de carte de fin : la vidéo boucle.** TikTok et Shorts la relancent toute seule ; la dernière phrase se poursuit sur le hook
  (« …and until someone is finally allowed to dig, » → « Somewhere under this landfill… »). Le dernier beat s'écrit
  `<Beat id="bN" loop>` (sans `bg`) : voir « La boucle » plus bas.

À lire avant d'écrire :
1. `src/tales/pixel/PIXEL.md` : les règles de cohérence du pixel art (grille, palette, proportions, animation). Elles priment sur tout.
2. `src/tales/stories/howells.tsx` + `content/tales/howells.json` : l'exemple de référence.

## Principe : simple et cohérent

Une story, c'est **un plan par beat** : un **fond aplat éclairé de la palette Where'd Gains Go?** (sur le `<Beat>`) +
**un élément principal** (un personnage qui agit, un objet, un écran, un flux d'icônes) + **2 à 4 détails qui vivent** (icônes,
onde, étincelles, pièces qui volent) + au plus 2 infos (titre, compteur, étiquette, tampon). Pas de décor peint : la couleur et la
lumière du fond posent l'ambiance, les icônes et le mouvement donnent la richesse.
**Un personnage seulement quand quelqu'un agit** (marche, dépose, mine, s'en va). Un plan sur une idée, un chiffre, un mécanisme
(clés → disque, refus du conseil, verdict) se raconte mieux sans personnage, avec des tuiles d'icônes. Tu **assembles des pièces de la bibliothèque** ; tu ne dessines pas de pixels toi-même
(pas de `Canvas`, sauf pour un objet vraiment absent de la bibliothèque, et alors dans le même style : contour encre, palette `PAL`).

## Contrat du fichier

Écris `src/tales/drafts/<slug>.tsx` :

```tsx
import React from "react";
import { Beat, useBeat, useTale, Skyline, Person, Prop, Icon, Fly, Move, Label, PAL, GROUND } from "../kit";
import type { StoryProps } from "../types";

const Hook: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Skyline />
      <Person look="hacker" x={-10} to={40} dur={b.at("wallet")} />
      <Prop name="bin" x={60} />
      <Fly name="coin" from={[40, 70]} to={[70, 40]} at={b.at("stole")} arc={8} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1" bg="ink"><Hook /></Beat>
    {/* un <Beat> par beat du JSON, sauf le beat "product" */}
  </>
);
```

- **Imports autorisés** : `react`, `remotion` (`useCurrentFrame`…), `../kit`, `../types`.
- **Interdits** (vérifiés par `tale-check`) : `<Audio>`, `<Video>`, `<Img>`, `staticFile`, URLs, `require`, `fetch`, `Math.random`,
  `Date.now`, et tout ce qui casse le pixel art : `blur(`, `rotate(`, `opacity` en fondu, `interpolate` lisse sur un sprite.
- Les ids de `<Beat id>` doivent exister dans le JSON.

## Sons

Les composants du kit sonnent tout seuls, très bas sous la voix, au moment où ils apparaissent : coupe de plan (souffle),
`Tile` / `Icon` / `Pin` / `Bubble` (pop), `Prop` (petite chute), `Label` (blip), `Stamp` (tampon), `Counter` (défilement),
`Fly` (tintement pour une pièce, souffle sinon), `Move` (passage), `Screen` (clavier pendant la frappe), `Chart` / `Bar` (montée),
`Arrow` (tick), `Pulse` (ping), `Sparkle` (scintillement). Un élément présent dès la frame 0 du plan ne sonne pas.
Tu n'as donc rien à ajouter. Seule exception : une animation faite à la main (`useCurrentFrame`) qui mérite un son, avec
`<Sound name="a-swish" at={b.at("mot")} />` (noms : `a-pop`, `a-thud`, `a-blip`, `a-stamp`, `a-count`, `a-coin`, `a-swish`,
`a-type`, `a-rise`, `a-ping`, `a-twinkle`, `a-tick`). Sobre : un son par mouvement important, jamais en rafale.
`Fly sound={false}` / `Label sound={false}` rendent un élément muet. Les bruitages narratifs (suspense, révélation) viennent du
script : n'en ajoute pas.

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

**Fonds (aplat + lumière)** : sur le beat, `<Beat id bg="ink|deep|paper|pink|lime|cyan" floor? light? ambient? />`.
- Un aplat plein écran de la palette Where'd Gains Go? + un sol en bande d'un ton voisin (`floor={false}` pour un plan sans sol :
  écran de terminal, gros plan d'icônes).
- `ink` (défaut, nuit, mystère), `deep` (intérieur, calme), `paper` (archives, document, passé), `pink` (choc, tribunal, perte),
  `lime` (gain, victoire), `cyan` (jour, institution, technique). Varie d'un plan à l'autre pour rythmer, sans plus de 3 couleurs par vidéo.
- `light` : un éclairage en pixels tramés (dégradé par paliers, jamais flou) qui donne du volume à l'aplat.
  `glow` (halo central qui respire doucement : hook, mystère, outro), `spot` (cône de lampe + flaque au sol : scène de nuit, rue,
  aveu), `top` (lumière de plafond : intérieur, bureau, institution), `none`. Une lumière par plan, choisie pour l'émotion.
- `ambient` : particules discrètes dans la lumière : `dust` (poussière qui flotte : nuit, attente), `sparks` (étincelles qui montent :
  tension, révélation, argent), `none` (défaut). Au plus un plan sur deux.
- Le texte du kit s'adapte tout seul (encre sur fond clair, papier sur fond sombre).
- Au plus **un** élément de contexte, en aplat d'un ton voisin du fond : `<Mound x? w? h? />` (tas, décharge, colline) ou
  `<Skyline />` (silhouette de ville). Pas de ciel, d'étoiles, de fenêtres, de déchets colorés.

**Échelle (une seule logique, la clé de la cohérence)** : un personnage fait **20 cellules ≈ 1,70 m**, donc 1 cellule ≈ 8,5 cm.
Tout ce qui est *dans le monde* (au sol, sur un bureau, en main, qui roule ou vole dans la scène) est à cette échelle : `Prop` / `Move`.
Les *symboles* (une pièce, une clé, un wallet qui flotte, un gros plan) sont des icônes plus grandes : `Icon` / `Fly`. Ne mélange pas :
pas d'icône posée au sol à côté d'un personnage, pas d'objet du monde agrandi.

**Personnages** : `<Person look x y? at? to? dur? pose? face? hold? />` (12 × 20 cellules, simples, de profil)
- `look` : `dev`, `hacker`, `suit`, `cop`, `trader`, `teen`, `judge`, `worker`, `founder`, `whale`
  (ou une tenue `{ shirt, hair, hairStyle: "short|long|bald", skin, pants, wear: "hood|cap|tie|glasses|beanie" }`).
- `x` = colonne des pieds, `y` = ligne du sol (défaut `GROUND`). Avec `to` + `dur` : il **marche** de `x` à `to` (cycle de marche),
  puis prend `pose` : `idle`, `cheer` (bras levé), `point` (montre devant lui), `shrug`, `sit` (sur une `chair`, même `x` à 1 près).
- `face="left|right"` (sinon il regarde où il va), `hold` = petit objet en main : `drive`, `laptop`, `phone`, `coin`, `bag`, `doc`.
- Entrer / sortir du cadre : partir de `x={-10}` ou aller à `to={100}`.
- **Personnes réelles** : un rôle neutre et un prénom ou une initiale dans une étiquette, jamais de caricature ni d'accusation.

**Objets du monde** (à l'échelle) : `<Prop name x y? at? flip? out? />` = (x, y) milieu du bas, posé sur le sol (ou `y={GROUND - 9}` sur un `desk`).
- Ville : `house` (40 × 44), `bank` (60 × 50, aussi tribunal / mairie), `truck` (56 × 28), `car` (40 × 15), `bin`, `lamp`, `tree`, `sign`
- Intérieur : `desk`, `chair`, `computer` (sur le bureau), `laptop` (sur le bureau), `server`, `chest`
- Petits objets réels : `drive`, `phone`, `coin`, `bag`
- Divers : `drone`, `robotdog`, `rocket`, `fire`
- `<Move name from={[x,y]} to={[x,y]} at dur? arc? vanish? />` : un objet du monde qui se déplace ([x, y] = milieu du bas) : camion ou voiture
  qui passe, drone qui vole, disque qui tombe dans une poubelle. Les véhicules se tournent tout seuls dans le sens du mouvement.

**Icônes** (symboles, ≈ 7 à 18 cellules) : `<Icon name x y at? out? />` centrée en (x, y), en l'air ou en gros plan.
Deux familles, mêlables dans un plan :
- **Icônes fines `px-…`** (12 × 12 cellules, dessinées au pas du pixel de texte, donc 2 fois plus de détail ; d'après pixelarticons,
  colorées et ombrées aux couleurs du kit). **À préférer pour les symboles en vedette, les tuiles et les flux** :
  - argent : `px-wallet`, `px-money`, `px-banknote`, `px-dollar`, `px-euro`, `px-card`, `px-bank`, `px-store`, `px-receipt`,
    `px-invoice`, `px-gem`, `px-gift`, `px-percent`
  - sécurité, hack : `px-key`, `px-lock`, `px-unlock`, `px-shield`, `px-eye`, `px-search`, `px-bug`, `px-skull`, `px-bomb`, `px-fire`,
    `px-zap`, `px-warning`, `px-siren`, `px-target`, `px-link`
  - tech : `px-terminal`, `px-code`, `px-database`, `px-server`, `px-cpu`, `px-gpu`, `px-computer`, `px-laptop`, `px-smartphone`,
    `px-usb`, `px-qr`, `px-cloud`, `px-globe`, `px-blocks` (blockchain), `px-robot`, `px-power`
  - marché : `px-chartUp`, `px-chartDown`, `px-chartLine`, `px-analytics`, `px-trophy`, `px-crown`, `px-star`, `px-sparkles`,
    `px-heart`, `px-thumbsUp`, `px-thumbsDown`
  - messages, temps, lieux : `px-mail`, `px-message`, `px-megaphone`, `px-bell`, `px-clock`, `px-hourglass`, `px-calendar`, `px-flag`,
    `px-pin`, `px-file`, `px-script`, `px-briefcase`, `px-package`, `px-trash`, `px-home`, `px-building`, `px-factory`, `px-truck`,
    `px-car`, `px-user`, `px-users`, `px-dog`, `px-alien`, `px-trex`, `px-snowflake`, `px-moon`, `px-sun`
- **Icônes du kit** (pixel plein, plus massives ; les seules pour les jetons et les objets de l'histoire) :
  - crypto : `coin` (BTC), `eth`, `stable` (USDT), `doge`, `wallet`, `hwallet` (wallet matériel), `key`, `lock`, `unlock`, `vault`,
    `chest`, `bag` (sac de $), `block`, `link`, `goldbar`, `cash`, `card`, `piggy`
  - marché : `chart`, `chartUp`, `chartDown`, `candles`, `bull`, `bear`, `whale`, `gem`, `trophy`, `rocketUp`, `moon`, `arrowUp`, `arrowDown`
  - tech : `drive`, `phone`, `laptop`, `doc`, `terminal`, `robot`, `qr`, `signal`, `cloud`
  - justice, sécurité : `gavel`, `scales`, `handcuffs`, `shield`, `eye`, `magnifier`, `skull`, `bomb`, `warning`, `bell`
  - divers : `pizza`, `crown`, `fire`, `lightning`, `hourglass`, `clock`, `calendar`, `mail`, `chat`, `megaphone`, `flag`, `globe`,
    `snowflake`, `star`, `heart`, `check`, `cross`
- Les pièces qui volent restent `coin` / `eth` (petites, massives) ; une icône fine ne vole pas en nuée.
- `<Fly name from={[x,y]} to={[x,y]} at dur? arc? vanish? />` : une icône qui vole (pièces qui s'envolent d'un wallet à l'autre, clé qui
  rejoint un disque). `arc` = hauteur de la parabole, `vanish` = disparaît à l'arrivée.

**Infos** (police bitmap du kit, sur la grille : majuscules, chiffres, ponctuation, `→ ← ↑ ↓ ≈ · $ € £ ₿ %` ; positions en cellules, centrées)
- `<Title text y? at? />` : titre en haut (lettres de 12 px, ~14 caractères par ligne), `*mots*` sur un bloc rose. Le beat `hook` affiche `tale.hook` avec `<Title>`.
- `<Counter value x? y at color? label? />` : grand nombre qui défile par paliers (« $319,000,000 », « 8,000 BTC » ; 14 caractères max).
- `<Label x y at text color? textColor? out? />` : étiquette dans un cadre (date, lieu, nom, rôle). Une date ou un lieu par plan, en haut (y ≈ 16).
- `<PixelText text x y color? scale? align? max? />` : texte libre sans cadre (`scale` 1 = 6 px, 2 = 12 px).
- `<Bubble x y at text out? />` : bulle de dialogue (pointe en (x, y), au-dessus d'une tête : y = sol − 36). **Seulement pour une citation
  rapportée par les sources** (sinon une `<Label>`).
- `<Stamp x? y at text color? />` : tampon à double cadre (« DENIED », « HACKED », « FROZEN »), une fois par plan au plus.
- `<Screen x y w h at lines title? color? />` : écran de terminal où le texte se tape (post de forum, message on-chain, code, transaction).
  (x, y) = coin haut gauche.
- `<Chart x y w h at points labels? color? />` : courbe de prix tracée par paliers ; `labels={[{ i, text }]}` sur des points.
- `<Bar x y w at to label? color? dither? />` : jauge (85 % rendus, 15 % gardés…).
- `<Arrow from to at color? dashed? />` : flèche d'un pixel. `<Pin x y at label? />` : épingle de lieu.

**Détails qui vivent** (la richesse d'un plan, sans le surcharger)
- `<Tile icon x y at label? color? labelMax? />` : une icône sur un socle carré, étiquette dessous ; (x, y) = centre. Brique des plans
  sans personnage. Passe par le garde-fou comme un texte.
- `<Flow y items={[{ icon, label?, at }]} arrows? gap? />` : une rangée de 2 à 4 tuiles centrée, reliées par des flèches qui se tracent
  (`arrows={false}` pour une simple liste : « drones, chiens robots, investisseurs »). Tient toujours dans la largeur (les étiquettes trop
  longues passent sur 2 lignes). Pour d'où vient l'argent → où il va, les étapes d'un hack, avant / après.
- `<Pulse x y at? color? max? />` : anneaux qui s'élargissent par paliers autour de l'élément clé (le disque perdu, le wallet piraté).
  Place-le **avant** l'icône dans le JSX (il passe dessous).
- `<Sparkle x y at? color? phase? />` : une étincelle qui scintille ; par 2 ou 3 autour d'un objet précieux (`phase` 0–3 pour les décaler).
- `<Rain name at count? from? toX? floor? stagger? />` : une pluie d'icônes qui tombent jusqu'au sol (des millions qui partent, des alertes).
- Recette d'un plan riche : **1 élément principal + 1 détail animé (Pulse, Sparkle, Fly, Rain) + 1 info**, le tout calé sur les mots.

## La boucle (dernier beat)

- `<Beat id="bN" loop>` sur le **dernier** beat, sans `bg` / `light` / `ambient` : il reprend automatiquement le fond du premier beat,
  avec une animation de lumière et de particules calée pour que sa dernière frame précède exactement la frame 0.
- Ses enfants jouent pendant la phrase ; **juste après le dernier mot, le kit affiche la frame 0 du premier plan** jusqu'à la fin
  (les sous-titres s'arrêtent aussi). Quand la plateforme relance la vidéo, l'image ne saute pas.
- Pour que la coupure interne (plan final → frame 0 du hook) soit douce, compose le dernier plan **comme le hook** : même élément de
  contexte (même `Mound` / `Skyline`, mêmes positions), et un mouvement qui y ramène (quelqu'un sort du cadre, un objet revient à sa place).
- `tale-check` refuse une story dont le dernier beat n'a pas `loop`, et produit `loop-end.png` (dernière frame) et `loop-start.png`
  (frame 0) : les deux images doivent être identiques.

## Style et rythme

- **Un plan = un fond aplat éclairé + un élément principal + quelques détails vivants.** Change de couleur de fond quand l'histoire
  change de lieu, d'époque ou d'émotion ; sinon garde-la et fais bouger la scène. Le vide fait partie du style : ne remplis pas l'écran.
- **Alterne** plans avec personnage (une action) et plans d'icônes (une idée) : pas plus de 2 plans d'affilée avec le même personnage.
- **Du mouvement à chaque plan** : quelqu'un marche, un objet vole, un écran se tape, un camion passe. Un changement visible au moins toutes les ~2 s.
- **Lisible sur téléphone** : au plus 1 personnage principal, 3 à 6 éléments à l'écran, les infos en haut, l'action au sol.
- Le hook est fort dès la frame 0 : `Title` + un décor qui pose l'énigme + un premier mouvement.
- **Textes : un garde-fou les empêche de se chevaucher** (un texte qui en touche un autre est décalé juste en dessous, et jamais
  dans la barre du haut ni dans la zone des sous-titres). Place-les quand même proprement : un décalage automatique est un signal
  de plan trop chargé.
- Pas de fondu, pas de rotation, pas de flou, pas de zoom lisse : en pixel art tout apparaît, tombe ou se déplace **par paliers**.
- Reste fidèle aux faits du JSON : n'invente ni chiffre, ni citation, ni titre de presse.

## Méthode

1. Lis le JSON (`beats` : texte dit + brief `visual`, `facts`, `sources`, `product.beat`), `PIXEL.md` et l'exemple.
2. Pour chaque beat (sauf product) : choisis le fond et sa lumière, l'élément principal (une action avec personnage, ou une idée en
   icônes), les détails qui vivent, et au plus 2 infos, chacun calé sur un mot.
3. Écris le fichier, puis lance `node scripts/tale-check.mjs <slug> --draft` (dernière ligne : JSON `{ ok, errors, stills, sheet }`).
4. Corrige les erreurs, puis **regarde les images** (`sheet`, `stills`, et `--frames=…` pour d'autres instants) : lisibilité, chevauchements,
   zones interdites, cohérence avec la phrase, cohérence avec la référence. Itère (3 passes max), puis termine par un résumé d'une ligne par beat.
