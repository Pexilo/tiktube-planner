// Story pixel art : la puce espionne cachée dans des Ledger vendus par CryptoBilis (octobre 2026).
// Un plan par beat (le dernier boucle sur le premier : <Beat loop>), chaque mouvement calé sur un mot via useBeat().at("mot").
// Grille : 90 colonnes × 160 lignes. Trois fonds : encre (mystère, nuit), rose (pertes), cyan (Ledger, technique).
// Personnages seulement quand quelqu'un agit : le propriétaire qui recopie ses mots (b2), l'inconnu qui lit par-dessus son épaule (b9).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Arrow, Beat, Canvas, Counter, Fly, GROUND, Icon, Label, PAL, Person, PixelText, Prop, Pulse, Sparkle, Sprite, Stamp, Tile, Title, useBeat, useTale } from "../kit";
import type { IconName, Look } from "../kit";
import type { StoryProps } from "../types";

/** Le propriétaire : orange, lisible sur l'encre comme sur le cyan. */
const OWNER: Look = { shirt: PAL.orange, hair: PAL.hair1, skin: PAL.skin2 };

/** Modulo toujours positif. */
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Affiche ses enfants à partir de `at`. */
const Show: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => (useCurrentFrame() >= at ? <>{children}</> : null);

/* ------------------------------------------------------------------ Sprites absents de la bibliothèque (même style : contour encre, PAL) */

/** Boîte scellée de wallet matériel (34 × 22, gros plan) ; l'espionne a une antenne qui sort du couvercle (13 lignes au-dessus). */
const BOX_W = 34;
const BOX_H = 22;
const ANT = 13;
const boxCanvas = (t: number, spy: boolean) => {
  const y = ANT;
  const c = new Canvas()
    // couvercle, jointure, boîte (lumière en haut à gauche, ombre à droite et en bas)
    .rect(0, y, BOX_W, 6, PAL.paper)
    .rect(BOX_W - 1, y, 1, 6, PAL.paper2)
    .rect(0, y + 6, BOX_W, 1, PAL.ink2)
    .rect(0, y + 7, BOX_W, 15, PAL.paper2)
    .rect(BOX_W - 1, y + 7, 1, 15, PAL.grey)
    .rect(0, y + 21, BOX_W, 1, PAL.grey)
    // l'appareil imprimé sur la boîte, deux lignes de texte
    .rect(4, y + 9, 8, 10, PAL.ink3)
    .rect(5, y + 10, 6, 3, PAL.lime)
    .set(6, y + 15, PAL.grey)
    .set(9, y + 15, PAL.grey)
    .rect(15, y + 10, 12, 1, PAL.grey)
    .rect(15, y + 13, 8, 1, PAL.grey)
    // l'autocollant d'inviolabilité, coupé net sur la jointure
    .rect(23, y + 2, 5, 4, PAL.pink)
    .rect(23, y + 7, 5, 4, PAL.pink)
    .rect(27, y + 2, 1, 4, PAL.pink2)
    .rect(27, y + 7, 1, 4, PAL.pink2);
  if (spy) {
    // la lumière qui fuit par la jointure (paliers de 6 frames)
    for (let x = 1; x < BOX_W - 1; x++) if ((x * 5 + Math.floor(t / 6)) % 7 === 0) c.set(x, y + 6, PAL.lime);
    // l'antenne, son voyant, ses barres de signal qui se remplissent
    c.rect(9, 2, 1, y - 2, PAL.grey).set(9, 1, Math.floor(t / 8) % 2 === 0 ? PAL.pink : PAL.pink2);
    const lit = (Math.floor(t / 8) + 2) % 5;
    [2, 3, 4, 5].forEach((h, i) => c.rect(12 + i * 2, 7 - h, 1, h, i < lit ? PAL.lime : PAL.grey2));
  }
  return c.outline();
};

/** Tapis roulant (bande encre, repères qui défilent de `shift`), posé sur le sol. Mêmes positions dans le hook et l'outro. */
const BELT_Y = 100;
const BOX_X = 45;
const Belt: React.FC<{ shift?: number }> = ({ shift = 0 }) => {
  const c = new Canvas().rect(0, 0, 90, 1, PAL.grey2).rect(0, 1, 90, 4, PAL.ink3);
  for (let x = 0; x < 90; x++) if (mod(x - shift, 8) < 2) c.set(x, 2, PAL.grey2);
  return <Sprite canvas={c.outline()} x={0} y={BELT_Y} w={90} h={5} anchor="topleft" drop={false} />;
};

const SealedBox: React.FC<{ x: number; spy?: boolean }> = ({ x, spy = false }) => {
  const frame = useCurrentFrame();
  return <Sprite canvas={boxCanvas(frame, spy)} x={x} y={BELT_Y} w={BOX_W} h={BOX_H + ANT} drop={false} />;
};

/** La carte de récupération (symbole, 23 × 20) : 12 mots en 2 colonnes ; `n` = mots déjà écrits. */
const cardCanvas = (n: number) => {
  const c = new Canvas().rect(0, 0, 23, 20, PAL.paper).rect(22, 0, 1, 20, PAL.paper2).rect(0, 19, 23, 1, PAL.paper2);
  for (let i = 0; i < n; i++) {
    const x = i < 6 ? 2 : 13;
    const y = 2 + (i % 6) * 3;
    c.set(x, y, PAL.grey).rect(x + 2, y, 6, 1, PAL.ink3);
  }
  return c.outline();
};
const WordCard: React.FC<{ x: number; y: number; n: number; at?: number }> = ({ x, y, n, at = 0 }) => (
  <Sprite canvas={cardCanvas(n)} x={x} y={y} w={23} h={20} at={at} anchor="center" />
);

/** Puce vue de dessus : corps rose 15 × 11 avec reflet et ombre, pattes grises, voyant `led`. */
const chipCanvas = (led: string) => {
  const c = new Canvas().rect(2, 2, 15, 11, PAL.pink).rect(2, 12, 15, 1, PAL.pink2).rect(16, 2, 1, 11, PAL.pink2).rect(3, 3, 4, 1, PAL.paper).set(14, 3, led);
  for (const k of [4, 7, 10]) c.rect(0, k, 2, 1, PAL.grey).rect(17, k, 2, 1, PAL.grey);
  for (const k of [5, 9, 13]) c.rect(k, 0, 1, 2, PAL.grey).rect(k, 13, 1, 2, PAL.grey);
  return c.outline();
};

/** La puce espionne (rose, un œil, voyant qui clignote) centrée en (x, y). La même dans le démontage et dans le vol des mots. */
const SpyChip: React.FC<{ x: number; y: number; at?: number }> = ({ x, y, at = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Sprite canvas={chipCanvas(Math.floor(frame / 6) % 2 === 0 ? PAL.lime : PAL.ink3)} x={x} y={y} w={19} h={15} at={at} anchor="center" />
      <Icon name="eye" x={x} y={y} at={at} />
    </>
  );
};

/** Carte électronique du wallet ouvert (56 × 34) : pistes, port USB, secure element encre. Coin haut gauche en (x, y). */
const boardCanvas = () => {
  const c = new Canvas().rect(0, 0, 56, 34, PAL.lime2).rect(0, 0, 56, 1, PAL.lime).rect(-3, 13, 3, 8, PAL.grey);
  for (const [x0, y0, x1, y1] of [[4, 6, 30, 6], [30, 6, 30, 12], [4, 28, 50, 28], [50, 28, 50, 20], [10, 22, 10, 28], [22, 22, 22, 28]]) c.line(x0, y0, x1, y1, PAL.lime);
  c.rect(4, 10, 13, 11, PAL.ink3).rect(5, 11, 4, 1, PAL.grey).set(15, 19, PAL.cyan).rect(4, 20, 13, 1, PAL.ink2);
  for (const k of [12, 15, 18]) c.rect(2, k, 2, 1, PAL.grey).rect(17, k, 2, 1, PAL.grey);
  return c.outline();
};

/** Couvercle du wallet (le boîtier fermé vu de dessus) : écran encre, deux boutons. */
const lidCanvas = () =>
  new Canvas().rect(0, 0, 56, 34, PAL.paper2).rect(0, 0, 56, 1, PAL.paper).rect(8, 8, 32, 18, PAL.ink2).rect(9, 9, 8, 1, PAL.ink3).rect(46, 10, 4, 4, PAL.grey).rect(46, 20, 4, 4, PAL.grey).outline();

/** eSIM : petite carte lime, coin coupé, contacts encre. */
const esimCanvas = () => new Canvas().rect(0, 1, 9, 6, PAL.lime).rect(1, 0, 8, 1, PAL.lime).rect(2, 2, 2, 3, PAL.ink3).rect(5, 2, 2, 3, PAL.ink3).rect(0, 6, 9, 1, PAL.lime2).outline();

/** Antenne-relais en treillis (13 × 30), voyant en haut. */
const towerCanvas = (blink: boolean) => {
  const c = new Canvas().line(6, 2, 1, 29, PAL.grey).line(6, 2, 11, 29, PAL.grey);
  for (const y of [9, 16, 23]) {
    const half = Math.round((5 * (y - 2)) / 27);
    c.line(6 - half, y, 6 + half, y, PAL.grey);
  }
  c.rect(3, 4, 1, 4, PAL.paper2).rect(9, 4, 1, 4, PAL.paper2).rect(6, 0, 1, 2, blink ? PAL.paper : PAL.grey);
  return c.outline();
};

/** Panneau de code sans texte (36 × 26) : barres colorées comme du code, `n` lignes déjà tapées. */
const CODE: [number, number, string][] = [[2, 12, PAL.lime], [4, 18, PAL.cyan], [6, 10, PAL.paper2], [6, 14, PAL.cyan], [4, 8, PAL.pink], [4, 16, PAL.paper2], [2, 6, PAL.lime]];
const codeCanvas = (n: number) => {
  const c = new Canvas().rect(0, 0, 36, 26, PAL.ink2).rect(0, 0, 36, 3, PAL.ink3).set(2, 1, PAL.pink).set(4, 1, PAL.orange).set(6, 1, PAL.lime);
  CODE.slice(0, n).forEach(([x, w, col], i) => c.rect(x, 5 + i * 3, w, 1, col));
  return c.outline();
};

/** Grand point d'interrogation (le « ? » de la police, pixels de 2 × 2 cellules), ombre dure rose foncé. */
const QMARK = [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."];
const qmarkCanvas = () => {
  const c = new Canvas();
  for (const [dx, col] of [[1, PAL.pink2], [0, PAL.pink]] as const) QMARK.forEach((row, j) => [...row].forEach((v, i) => v === "#" && c.rect(i * 2 + dx, j * 2 + dx, 2, 2, col)));
  return c.outline();
};

/** Grille de 300 wallets (20 × 15) sur un panneau encre ; `drained` wallets vidés, dans un ordre mélangé. */
const gridCanvas = (drained: number) => {
  const c = new Canvas().rect(0, 0, 61, 46, PAL.ink2);
  for (let i = 0; i < 300; i++) {
    const x = 1 + (i % 20) * 3;
    const y = 1 + Math.floor(i / 20) * 3;
    const empty = (i * 97) % 300 < drained;
    c.rect(x, y, 2, 2, empty ? PAL.ink3 : PAL.lime).set(x, y, empty ? PAL.ink3 : PAL.paper);
  }
  return c.outline();
};

/** Bloc de glace tramé (26 × 32) : le givre monte par le bas (`rows` lignes visibles), les pièces restent visibles dessous. */
const iceCanvas = (rows: number) => {
  const W = 26;
  const H = 32;
  const top = H - rows;
  const c = new Canvas();
  for (let y = top; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Tramage léger (1 pixel sur 4) : le logo des pièces reste lisible sous la glace.
      const col = x === 0 || y === top ? PAL.paper : x === W - 1 || y === H - 1 ? PAL.cyan2 : x % 2 === 0 && (x + y) % 4 === 0 ? PAL.cyan : null;
      if (col) c.set(x, y, col);
    }
  if (rows === H) for (const [x, y] of [[3, 3], [4, 4], [5, 5], [3, 6], [4, 7]]) c.set(x, y, PAL.paper);
  // Contour encre à la main : outline() remplirait le tramage.
  return c.rect(-1, top - 1, W + 2, 1, PAL.ink).rect(-1, H, W + 2, 1, PAL.ink).rect(-1, top, 1, rows, PAL.ink).rect(W, top, 1, rows, PAL.ink);
};

/* ------------------------------------------------------------------ Pièces partagées */

/** Le bureau du propriétaire, assis, qui recopie sur une feuille ; le petit wallet posé sur le bureau. Mêmes positions en b2 et b9. */
const DX = 54;
const deviceCanvas = new Canvas().rect(0, 0, 2, 1, PAL.ink3).set(1, 0, PAL.lime).outline();
const DeskSet: React.FC = () => (
  <>
    <Prop name="desk" x={DX} />
    <Sprite canvas={deviceCanvas} x={DX + 3} y={GROUND - 9} w={2} h={1} />
    <Prop name="chair" x={DX - 12} />
    <Person look={OWNER} x={DX - 11} pose="sit" hold="doc" />
  </>
);

/* ------------------------------------------------------------------ Plans */

/**
 * b1 — Le hook, sans le son : une boîte de wallet scellée sur un tapis roulant, l'autocollant fendu, une antenne qui sort du
 * couvercle et clignote, de la lumière qui fuit par la jointure. Le titre donne l'enjeu (« up to $93 million drained »),
 * la voix l'énigme (« someone got inside… »). Titre entier dès la frame 0, qui est aussi la frame de la boucle.
 */
const Hook: React.FC = () => {
  const { tale } = useTale();
  const b = useBeat();
  return (
    <>
      <Title text={tale.hook} y={16} at={-40} />
      <Belt />
      <Pulse x={BOX_X - 8} y={BELT_Y - 34} at={b.at("behind")} color={PAL.pink} max={10} />
      <SealedBox x={BOX_X} spy />
      <Sparkle x={BOX_X + 8} y={BELT_Y - 16} at={b.at("inside")} />
      <Sparkle x={BOX_X + 6} y={BELT_Y - 18} at={b.at("opened")} phase={2} />
      <Icon name="hourglass" x={BOX_X + 14} y={BELT_Y - 30} at={b.at("waiting")} />
    </>
  );
};

/** b2 — Les 24 mots : le propriétaire les recopie du wallet sur une carte ; le cadenas promet que personne ne les verra. */
const Keys: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const promises = b.at("promises");
  return (
    <>
      <Label x={45} y={16} at={b.at("keys")} text="24 words = your keys" color={PAL.lime} />
      <Icon name="hwallet" x={20} y={56} />
      <Arrow from={[25, 56]} to={[31, 56]} at={4} dur={6} dashed />
      <WordCard x={45} y={56} n={Math.min(12, 2 + Math.floor(frame / 9))} />
      <Pulse x={67} y={56} at={promises} max={12} />
      <Icon name="lock" x={67} y={56} at={promises} />
      <DeskSet />
    </>
  );
};

/** b3 — Le 9 octobre : 300 wallets se vident par paquets, les pièces filent hors champ, le compteur monte à 93,2 M$. */
const GX = 14;
const GY = 46;
const Drained: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const start = b.at("ninth");
  const end = b.at("wallets");
  const three = b.at("three", 2); // la 1re occurrence est dans « ninety-three »
  const drained = frame < start ? 0 : Math.floor((Math.min(1, (frame - start) / Math.max(1, end - start)) * 300) / 12) * 12;
  const coins: IconName[] = ["coin", "eth", "stable"];
  return (
    <>
      {/* L'étiquette s'allonge quand la voix dit « three hundred » : une seule info en haut. */}
      <Label x={45} y={16} at={b.at("october")} out={three} text="Oct 9" />
      <Label x={45} y={16} at={three} text="Oct 9 · 300+ wallets" />
      <Counter value="$93,200,000" y={30} at={b.at("up")} color={PAL.paper} label="up to · onchain estimate" />
      <Sprite canvas={gridCanvas(drained)} x={GX} y={GY} w={61} h={46} anchor="topleft" drop={false} />
      {Array.from({ length: 12 }).map((_, i) => (
        <Fly key={i} name={coins[i % 3]} from={[GX + 6 + ((i * 23) % 50), GY + 6 + ((i * 17) % 34)]} to={[-12, GY - 4 + ((i * 11) % 30)]} at={start + i * 18} dur={18} arc={6} vanish />
      ))}
    </>
  );
};

/** b4 — Le logiciel n'a pas été piraté (code net, coche, tampon) ; alors comment a-t-on vu les mots ? Le « ? » sur la carte. */
const NotBreached: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const never = b.at("never");
  const how = b.at("how");
  const wobble = [0, 1, 0, -1][Math.floor(frame / 5) % 4];
  return (
    <>
      <Sprite canvas={codeCanvas(Math.min(CODE.length, 1 + Math.floor(frame / 6)))} x={10} y={18} w={36} h={26} anchor="topleft" />
      <Pulse x={60} y={31} at={never} max={12} />
      <Icon name="check" x={60} y={31} at={never} />
      <Stamp y={52} at={b.at("breached")} text="NOT BREACHED" color={PAL.lime} />
      <WordCard x={30} y={88} n={12} at={b.at("so", 2)} />
      <Sprite canvas={qmarkCanvas()} x={58 + (frame >= how + 4 ? wobble : 0)} y={86} w={11} h={15} at={how} anchor="center" />
    </>
  );
};

/** b5 — Le fil commun : les lignes des wallets vidés convergent vers une seule boutique, CryptoBilis, en Asie du Sud-Est. */
const WALLETS_X = [13, 29, 45, 61, 77];
const Thread: React.FC = () => {
  const b = useBeat();
  const sold = b.at("sold");
  return (
    <>
      <Label x={45} y={16} at={b.at("southeast")} text="Southeast Asia" />
      {WALLETS_X.map((x, i) => (
        <Icon key={x} name="px-wallet" x={x} y={34} at={4 + i * 4} />
      ))}
      {/* Les fils s'arrêtent au-dessus de la boutique, écartés : leurs pointes ne se touchent pas. */}
      {WALLETS_X.map((x, i) => (
        <Arrow key={x} from={[x, 42]} to={[45 + Math.round((x - 45) / 2.5), 68]} at={b.at("thread") + i * 5} dur={12} />
      ))}
      <Pulse x={45} y={82} at={sold} max={16} />
      <Tile icon="px-store" x={45} y={82} at={sold} />
      <Label x={45} y={98} at={b.at("cryptobilis")} text="CryptoBilis" color={PAL.pink} />
    </>
  );
};

/** b6 — Ledger ouvre l'appareil : le couvercle se soulève par paliers ; à côté de la vraie carte, la passagère clandestine et son eSIM. */
const BX = 17;
const BY = 40;
const Stowaway: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const lift = b.at("inside");
  const chip = b.at("stowaway");
  const esim = b.at("esim");
  const lidY = BY - (frame < lift ? 0 : Math.min(30, Math.floor((frame - lift) / 2) * 3));
  return (
    <>
      <Sprite canvas={boardCanvas()} x={BX} y={BY} w={56} h={34} anchor="topleft" />
      {frame >= esim ? <Sprite canvas={new Canvas().line(0, 0, 0, 4, PAL.pink2)} x={BX + 40} y={BY + 20} w={1} h={5} anchor="topleft" drop={false} /> : null}
      <Pulse x={BX + 38} y={BY + 12} at={chip + 4} color={PAL.pink} max={14} />
      <SpyChip x={BX + 38} y={BY + 12} at={chip} />
      <Sprite canvas={esimCanvas()} x={BX + 40} y={BY + 28} w={9} h={7} at={esim} anchor="center" />
      {lidY > 14 ? <Sprite canvas={lidCanvas()} x={BX} y={lidY} w={56} h={34} anchor="topleft" drop={false} /> : null}
      <Stamp y={88} at={chip + 4} text="STOWAWAY" />
      <Label x={45} y={104} at={esim} text="+ its own eSIM" color={PAL.lime} />
    </>
  );
};

/** b7 — Son travail : attendre la configuration, lire les 24 mots à l'écran (ils passent au rose), les envoyer à l'antenne en LTE. */
const Job: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const setup = b.at("setup");
  const read = b.at("read");
  const send = b.at("send");
  const step = Math.max(1, (send - read) / 24);
  const reading = frame < read ? -1 : Math.floor((frame - read) / step);
  const slot = (i: number) => [13 + (i % 3) * 20, 27 + Math.floor(i / 3) * 4.5] as const;
  const bezel = new Canvas().rect(0, 0, 64, 50, PAL.ink3).rect(1, 1, 62, 48, PAL.ink2).outline();
  const dots = ".".repeat(Math.floor(frame / 8) % 4);
  const TX = 62;
  const TY = 112;
  return (
    <>
      <Sprite canvas={bezel} x={8} y={16} w={64} h={50} anchor="topleft" />
      <PixelText text={frame < setup ? `setup${dots}` : "24 recovery words"} x={13} y={20} color={PAL.lime} align="left" />
      {Array.from({ length: 24 }).map((_, i) => {
        if (frame < setup + i * 2) return null;
        const [x, y] = slot(i);
        return <PixelText key={i} text={`${String(i + 1).padStart(2, "0")} ███`} x={x} y={y} color={reading >= i ? PAL.pink : PAL.paper2} align="left" shadow={false} slot={false} />;
      })}
      <SpyChip x={22} y={88} />
      {reading >= 0 && reading < 24 ? <Arrow key={reading} from={[22, 80]} to={[slot(reading)[0] + 8, Math.round(slot(reading)[1] + 2)]} at={Math.round(read + reading * step)} dur={1} color={PAL.pink} dashed /> : null}
      <Sprite canvas={towerCanvas(Math.floor(frame / 8) % 2 === 0)} x={TX} y={TY} w={13} h={30} at={send - 8} />
      <Pulse x={TX} y={TY - 28} at={send + 10} color={PAL.paper} max={10} every={16} />
      {[0, 1, 2, 3].map((i) => (
        <Fly key={i} name="chat" from={[30, 86]} to={[TX - 2, TY - 28]} at={send + i * 8} dur={18} arc={10} vanish />
      ))}
      <Label x={42} y={104} at={b.at("lte")} text="LTE →" color={PAL.paper} />
    </>
  );
};

/** b8 — Ce que la puce n'a pas touché : secure element, système, transactions ; une coche sur chacun, puis le tampon. */
const UNTOUCHED: { icon: IconName; text: string; at: [string, number]; tick: string }[] = [
  { icon: "vault", text: "secure element", at: ["secure", 1], tick: "or" },
  { icon: "px-terminal", text: "operating system", at: ["operating", 1], tick: "and" },
  { icon: "px-receipt", text: "transactions", at: ["never", 2], tick: "single" },
];
const Untouched: React.FC = () => {
  const b = useBeat();
  return (
    <>
      {UNTOUCHED.map((r, i) => {
        const y = 30 + i * 24;
        const at = b.at(r.at[0], r.at[1]);
        return (
          <React.Fragment key={r.text}>
            <Tile icon={r.icon} x={16} y={y} at={at} />
            <Show at={at + 2}>
              <PixelText text={r.text} x={28} y={y - 1.5} align="left" />
            </Show>
            <Icon name="check" x={25} y={y - 8} at={b.at(r.tick)} />
          </React.Fragment>
        );
      })}
      <Stamp x={44} y={102} at={b.at("single") + 10} text="UNTOUCHED" color={PAL.lime} />
    </>
  );
};

/** b9 — Le coffre est resté fermé : quelqu'un, l'antenne en tête, lit simplement la carte par-dessus l'épaule du propriétaire. */
const Shoulder: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const enter = b.at("vault");
  const arrive = b.at("just");
  const locked = b.at("locked");
  const HX = 33;
  return (
    <>
      <Pulse x={22} y={36} at={locked} max={16} />
      <Tile icon="vault" x={22} y={36} at={enter} />
      <Icon name="lock" x={30} y={44} at={locked} />
      <Label x={22} y={55} at={locked} text="locked" color={PAL.lime} />
      <WordCard x={62} y={58} n={12} />
      <DeskSet />
      <Person look="hacker" x={-8} to={HX} at={enter} dur={Math.max(20, arrive - enter)} face="right" />
      {frame >= arrive && Math.floor(frame / 8) % 2 === 0 ? <Icon name="signal" x={HX} y={79} at={arrive} /> : null}
      <Arrow from={[HX + 5, 87]} to={[52, 68]} at={b.at("read")} dur={8} color={PAL.pink} dashed />
    </>
  );
};

/** b10 — Tether gèle 10 M$ de USDT (le givre monte sur la pile) ; Ledger parle d'une attaque physique de la chaîne d'approvisionnement. */
const Frozen: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const ice = b.at("froze") + 6;
  const physical = b.at("physical");
  const rows = frame < ice ? 0 : Math.min(32, (Math.floor((frame - ice) / 2) + 1) * 4);
  return (
    <>
      <Counter value="$10,000,000" y={24} at={b.at("ten")} color={PAL.paper} label="USDT frozen by Tether" />
      {[0, 1, 2, 3].map((i) => (
        <Icon key={i} name="stable" x={28} y={74 - i * 5} at={i * 3} />
      ))}
      {rows > 0 ? <Sprite canvas={iceCanvas(rows)} x={28} y={82} w={26} h={32} drop={false} /> : null}
      {[[15, 50], [41, 81]].map(([x, y], i) => (
        <Icon key={i} name="snowflake" x={x} y={y} at={ice + 8 + i * 5} />
      ))}
      <Pulse x={62} y={64} at={physical} color={PAL.paper} max={14} />
      <Tile icon="px-package" x={62} y={64} at={b.at("ledger")} />
      <Icon name="warning" x={69} y={55} at={physical} />
      <Label x={45} y={98} at={physical} text="physical supply-chain attack" max={56} />
    </>
  );
};

/** b11 — Le conseil de Ledger : appareil neuf de CryptoBilis, ne pas le configurer ; sinon, tout passer sur un nouvel appareil, nouvelle phrase. */
const Advice: React.FC = () => {
  const b = useBeat();
  const move = b.at("move");
  const coins: IconName[] = ["coin", "eth", "stable"];
  return (
    <>
      {/* 1re moitié : l'appareil jamais ouvert, à ne pas configurer. */}
      <Tile icon="px-package" x={18} y={30} at={b.at("unused")} />
      <Icon name="cross" x={26} y={22} at={b.at("don't")} />
      <Label x={57} y={30} at={b.at("don't")} text="don't set it up" color={PAL.pink} />
      {/* 2e moitié : l'ancien appareil (rose) → le nouveau (lime), avec sa nouvelle carte de mots. */}
      <Tile icon="hwallet" x={16} y={84} at={b.at("already")} color={PAL.pink} />
      <Arrow from={[28, 84]} to={[40, 84]} at={move} dur={6} color={PAL.ink} dashed />
      <Tile icon="hwallet" x={52} y={84} at={move} color={PAL.lime} />
      {coins.map((name, i) => (
        <Fly key={name} name={name} from={[16, 70]} to={[52, 70]} at={b.at("assets") + i * 8} dur={16} arc={10} vanish />
      ))}
      <WordCard x={52} y={60} n={12} at={b.at("fresh")} />
      <Label x={45} y={104} at={b.at("fresh")} text="new device · new phrase" color={PAL.lime} />
    </>
  );
};

/**
 * b13 — Outro qui boucle : le tapis roulant défile, des boîtes identiques passent, la loupe les longe puis se cale sur celle qui
 * a une antenne (« who? », « where? »). Le tapis s'arrête sur « supply » : la boîte est à sa place du hook. Après le dernier mot,
 * le kit montre la frame 0 du hook : « …where in the supply chain » → « Someone got inside this hardware wallet… ».
 */
const Outro: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const stop = b.at("supply");
  const shiftAt = (f: number) => Math.floor(Math.max(0, stop - f) / 2);
  const shift = shiftAt(frame);
  const sweep = b.at("investigating");
  const lock = b.at("who");
  const gone = b.at("chain");
  // La loupe longe les boîtes, puis suit l'antenne de la boîte espionne (une cellule à la fois).
  const target = (f: number) => BOX_X + shiftAt(f) - 8;
  const mx = frame < lock ? Math.round(10 + ((target(lock) - 10) * (frame - sweep)) / Math.max(1, lock - sweep)) : target(frame);
  return (
    <>
      <Belt shift={shift} />
      {[2, 1].map((k) => (
        <SealedBox key={k} x={BOX_X + shift - 64 * k} />
      ))}
      <SealedBox x={BOX_X + shift} spy />
      {frame >= sweep && frame < stop ? <Icon name="magnifier" x={mx} y={56} at={sweep} /> : null}
      <Label x={28} y={36} at={lock} out={gone} text="who?" color={PAL.pink} />
      <Label x={62} y={36} at={b.at("where")} out={gone} text="where?" color={PAL.lime} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1" bg="ink" light="glow" ambient="dust">
      <Hook />
    </Beat>
    <Beat id="b2" bg="ink" light="spot">
      <Keys />
    </Beat>
    <Beat id="b3" bg="pink" floor={false} light="top" ambient="sparks">
      <Drained />
    </Beat>
    <Beat id="b4" bg="cyan" floor={false} light="top">
      <NotBreached />
    </Beat>
    <Beat id="b5" bg="cyan" floor={false} light="glow">
      <Thread />
    </Beat>
    <Beat id="b6" bg="ink" floor={false} light="glow" ambient="sparks">
      <Stowaway />
    </Beat>
    <Beat id="b7" bg="ink" floor={false} light="top">
      <Job />
    </Beat>
    <Beat id="b8" bg="cyan" floor={false} light="glow">
      <Untouched />
    </Beat>
    <Beat id="b9" bg="cyan" light="top" ambient="dust">
      <Shoulder />
    </Beat>
    <Beat id="b10" bg="pink" floor={false} light="spot" ambient="sparks">
      <Frozen />
    </Beat>
    <Beat id="b11" bg="cyan" floor={false} light="top">
      <Advice />
    </Beat>
    {/* b12 = moment produit : dessiné par l'habillage (TaleVideo), rien ici. */}
    {/* Dernier plan : il boucle sur le premier (« …where in the supply chain » → « Someone got inside this hardware wallet… »). */}
    <Beat id="b13" loop>
      <Outro />
    </Beat>
  </>
);
