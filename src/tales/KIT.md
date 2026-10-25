# Kit « Crypto stories » : mode d'emploi pour écrire les visuels d'une story

Tu écris **uniquement la couche visuelle** d'un short narratif crypto (30–60 s, 1080 × 1920, 30 fps).
Tout le reste est fourni par l'habillage `src/tales/TaleVideo.tsx` et tu n'y touches pas :

- le fond registre (papier ligné sombre, marges roses, bandeau défilant) ; pas d'en-tête ni de barre de progression (immersion),
- la voix off, les sous-titres mot à mot et la musique,
- le **moment produit** (beat `role: "product"`) : une fiche Where'd Gains Go? couvre la scène. **Ne dessine rien pendant ce beat.**
- la carte de fin (« Follow for the next story »), sur les ~1,8 dernières secondes.

Référence de qualité à lire avant d'écrire : `src/tales/stories/howells.tsx` (et son JSON `content/tales/howells.json`).

## Contrat du fichier

Écris `src/tales/drafts/<slug>.tsx`. Il doit :

```tsx
import React from "react";
import { Beat, useBeat, Title, Board /* … */ } from "../kit";
import type { StoryProps } from "../types";

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1"><Hook /></Beat>
    <Beat id="b2"><Context /></Beat>
    {/* un <Beat> par beat du JSON, sauf le beat "product" */}
  </>
);
```

- **Imports autorisés** : `react`, `remotion` (`useCurrentFrame`, `interpolate`, `spring`, `Easing`…), `@remotion/paths`, `@remotion/shapes` (formes SVG : Star, Polygon, Circle…), `../kit`, `../types`.
- **Interdits** (vérifiés par `tale-check`) : `<Audio>`, `<Video>`, `<Img>`, `staticFile`, URLs, `require`, `fetch`, `Math.random`, `Date.now`.
  Tout est dessiné avec le kit, du SVG ou du CSS. Le rendu doit être déterministe (utilise `random("seed")` de remotion si besoin).
- Les ids de `<Beat id>` doivent exister dans le JSON.

## Repères et timing

- **Scène** : chaque `<Beat>` dessine dans une zone de **1000 × 1080 unités** (x vers la droite, y vers le bas), au-dessus des
  sous-titres (le haut de l'image reste libre pour l'interface TikTok / Shorts). Garde l'essentiel entre y = 60 et y = 1040 ; rien ne déborde à gauche ou à droite.
- **Temps** : dans un `<Beat>`, `useCurrentFrame()` vaut 0 au début du beat. `const b = useBeat()` donne :
  - `b.at("word")` = frame où ce mot est prononcé (insensible à la casse et à la ponctuation, 1re occurrence ; `b.at("word", 2)` pour la 2e ; `b.at(3)` pour le 4e mot).
    **Cale chaque apparition sur le mot qui la nomme** : c'est ce qui rend la vidéo captivante.
  - `b.dur` (durée du beat), `b.end` (fin de la phrase), `b.beat.text` / `b.beat.visual` (texte dit, brief visuel).
- `useTale()` donne `tale` (JSON complet : `hook`, `facts`, `eventDate`…) et la `timeline`.
- Un `<Beat>` disparaît à la fin de sa phrase. Pour enchaîner sans trou, `tail={8}` le prolonge de 8 frames.

## Style (identité Where'd Gains Go?)

- Palette uniquement : `INK` (#0B0B0E), `PAPER` (#EFEADF), `PAPER_2`, `GREY`, et les accents `PINK` (#FF2E88), `LIME` (#C6F24E), `CYAN` (#5CE1FF), `ORANGE`.
- Look **schéma 2D à l'encre** : traits épais (5–8), bordures encre, ombres franches décalées (pas de flou), tampons, étiquettes mono en majuscules.
- Hiérarchie : un élément principal par moment, 3–6 éléments max à l'écran. Grand et lisible sur téléphone (texte ≥ 28 px, titres 90–130).
- Rythme : **un changement visuel au moins toutes les ~2 s**, calé sur les mots. Le hook doit être fort dès la frame 0 (titre `tale.hook` + image choc).
- Pas d'animations qui clignotent ou secouent. Les entrées du kit (ressorts) suffisent.
- Le beat `hook` affiche `tale.hook` avec `<Title>` en haut (y ≈ 140) et une image qui pose l'énigme.
- Le beat `outro` reste sobre (la carte de fin le recouvre à la fin).

## API du kit (`../kit`)

Positions en unités scène. `at` = frame d'apparition (relative au beat). Les objets centrés sont placés par leur centre (x, y).

**Structure**
- `<Beat id tail?>` : séquence d'un beat (voir plus haut).
- `<Board x? y? w? h? at? tone="paper"|"ink" shadow? label? tag? ruled?>` : planche papier (ou encre) avec ombre colorée et en-tête mono (`tag` rose + `label`). Par défaut, toute la scène. Ses enfants sont en coordonnées planche (en-tête de 58 de haut).
- `<Camera keys={[{ at, x, y, zoom? }]} move?>` : grande planche dont on montre le point (x, y) au centre, avec glissements doux entre les clés. Parfait pour suivre un parcours (wallet → mixer → exchange).
- `<Appear at from="up|down|left|right|scale|drop|fade" out?>` : fait apparaître (et disparaître à `out`) n'importe quel contenu.
- `<At x y anchor? rot?>` : place un contenu libre.

**Dessin**
- `<InkPath d at dur? color? width? dashed? fill?>` : chemin SVG qui se trace (le `fill` arrive à la fin).
- `<Arrow from={[x,y]} to={[x,y]} at dur? bend? color? width? dashed? label?>` : flèche qui se trace, courbée si `bend`.
- `<Transfer from to at dur? bend? token="₿" amount? color? size?>` : un jeton glisse sur une flèche pointillée (son discret inclus).
- `<Coin symbol? size? color?>` : pièce plate (₿ orange par défaut ; "Ξ", "$", "Ð"…).
- `<Chain x y at count? first? highlight? label? size? stagger?>` : blocs qui s'enchaînent (n° de bloc, bloc mis en avant en rose).
- `<PriceChart x y w h at dur? points={[…]} color? start? end? labels={[{ i, text, color? }]}>` : courbe de prix tracée, étiquettes sur les points.
- `<Timeline x y w at items={[{ label, sub? }]} active? stagger?>` : frise de dates.
- `<Gauge x y w at to={0..1} color? label? value?>` : jauge hachurée + valeur qui défile.
- `<Callout x y to={[x,y]} at text color?>` : étiquette reliée à un point.
- `<Redacted x y w at lines? reveal? text? color?>` : lignes caviardées (sur planche encre : `color={PAPER}`) ; `reveal` les fait glisser pour montrer `text`.
- `<Tag x y at color? textColor? size? rot?>texte</Tag>` : petite étiquette mono.

**Objets**
- `<Icon name x? y? at? size? color? fill? box? rot?>` : picto au trait ; `box={PINK}` le pose sur une pastille bordée.
  Noms : key, lock, unlock, laptop, harddrive, phone, document, trash, truck, search, warning, skull, fire, rocket, bank, building, server,
  chartDown, chartUp, clock, calendar, mail, globe, link, shield, gavel, person, wallet, bubble, dollar, eye, question, pizza, plane,
  crown, qr, code, bomb, check, cross, arrowRight.
- `<Actor x y at? kind="person|hacker|suit|cop|dev|crowd" label? color? size? say? sayAt? hold? alert? flip?>` : personnage schématique
  (≈ 160 × 220 à `size` 1) ; `say` = bulle à partir de `sayAt` ; `hold` = picto tenu ; `alert` = « ! » à cette frame.
  **Personnes réelles : seulement un rôle neutre et un prénom ou une initiale** (« James H. · IT engineer »), jamais de caricature ni d'accusation.
- `<Bubble at text color? width?>` : bulle de dialogue.
- `<Wallet x y at? label? address balance? w? tone? status? statusAt? statusColor?>` : fiche wallet (adresse courte « 0x7a…f3 », solde qui défile, tampon d'état).
- `<Headline x y at? outlet date? text w? rot?>` : coupure de presse. **Uniquement pour des titres réellement publiés** par un média cité dans `tale.sources` ; sinon utilise `<Note>`.
- `<Stamp at text x? y? color? size? rot?>` : tampon qui claque (« DRAINED », « FROZEN », « NO BACKUP »).
- `<Counter x y at? value label? size? color? dur? align?>` : grand nombre qui défile jusqu'à `value` (« $600,000,000 », « 8,000 BTC »).
- `<Title x y at? text size? w? on="dark"|"paper" align? stagger?>` : titre cinétique, `*mot*` = surligné rose. `on="paper"` sur une planche papier.
- `<Note x y at? text w? color? rot? size?>` : post-it pour une citation ou un détail.
- `<Pin x y at? label? color? pulse?>` : épingle de lieu.
- `Sfx` (re-exporté) : `<Sfx name="pop|click|swipe|whoosh|ding|riser|shimmer" at volume?>`, avec parcimonie (le kit en joue déjà).

## Méthode

1. Lis le JSON de la story (`content/tales/<slug>.json`) : `beats` (texte + brief `visual`), `facts`, `sources`, `product.beat`.
2. Pour chaque beat (sauf product), choisis **une idée visuelle forte** qui explique l'événement comme un schéma (qui → quoi → où, flux d'argent,
   avant/après, chiffres). Fais varier les mises en page d'un beat à l'autre (planche papier, planche encre, fond nu, caméra).
3. Écris le fichier, puis lance `node scripts/tale-check.mjs <slug> --draft`. La dernière ligne est un JSON `{ ok, errors, stills, sheet }`.
4. Corrige les erreurs. Puis **regarde les images** (`sheet` = planche contact, `stills` = une image aux 2/3 de chaque beat) :
   lisibilité, débordements, chevauchements, zones vides, cohérence avec ce qui est dit. Ajoute `--frames=…` pour inspecter d'autres instants.
5. Itère (3 passes max), puis termine avec un résumé court de ce que montre chaque beat.
