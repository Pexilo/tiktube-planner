// Preuve de concept du style HD (entrée Remotion isolée) : cinq plans de la story « Bitcoin Pizza Day » sur la grille
// 180 × 320, objets pixelisés depuis des sources (SVG dessinés, capture réelle de l'app), lumière, poussière, caméra.
// Rendu : node scripts/hd-stills.mjs [hd-b1,hd-b2,…] [frame]  →  out/hd/<id>.png
import React from "react";
import { AbsoluteFill, Composition, registerRoot, staticFile, useCurrentFrame } from "remotion";
import { textWidth } from "../pixel/font";
import { chair, desk, forumPost, keyboard, mug, priceTag, screenPage, stickyNote } from "./draw";
import { GROUND } from "./grid";
import { tone } from "./palette";
import { hdPerson, type HDLook } from "./people";
import { Cells, Pix } from "./pixelize";
import { BOX_FRONT, coinHero, coinStacks, CRT, crtMonitor, pizzaBoxClosed, pizzaBoxOpen } from "./sources";
import { Glow, Reflect, Stage, Steam, Txt, type Scene } from "./stage";

const LASZLO: HDLook = { shirt: "cyan", pants: "stone", pantsStep: 2, hair: 2, glasses: true };
const INK = tone("ink", 1);
const PAPER = tone("stone", 6);
/** Décalage vertical (cellules) pour poser une boîte de largeur w sur une autre : la hauteur de sa tranche. */
const stack = (w: number) => Math.round(((w * 178) / 400) * BOX_FRONT);

/** Maquette des sous-titres du kit (mots en lettres de 12 px, mot courant dans un bloc lime) pour juger le cadrage. */
const Caption: React.FC<{ words: string[]; hi?: number; y?: number }> = ({ words, hi = -1, y = 262 }) => {
  const ws = words.map((w, i) => textWidth(w) * 2 + (i === hi ? 6 : 0));
  let x = Math.round(90 - (ws.reduce((a, b) => a + b, 0) + 12 * (words.length - 1)) / 2);
  return (
    <>
      {words.map((w, i) => {
        const el = <Txt key={i} text={w} x={x} y={y} k={2} align="left" color={i === hi ? INK : PAPER} shadow={i === hi ? false : INK} box={i === hi ? tone("lime", 3) : undefined} />;
        x += ws[i] + 12;
        return el;
      })}
    </>
  );
};

/* ------------------------------------------------------------------ b1 : le hook */

const B1_SCENE: Scene = { wall: tone("ink", 5), floor: tone("ink", 6), ambient: 0.2, lamps: [{ kind: "cone", x: 90, top: -40, spread: 0.27, core: 10, power: 0.85, beam: 0.55 }], dust: 90, seed: 11 };
const B1: React.FC = () => {
  const world = (
    <>
      <Pix src={pizzaBoxClosed()} mode ramps={["stone", "pink", "tomato", "orange"]} w={128} x={90} y={GROUND} />
      <Pix src={pizzaBoxClosed()} mode ramps={["stone", "pink", "tomato", "orange"]} w={128} x={91} y={GROUND - stack(128)} />
      <Cells draw={() => stickyNote(["TOO", "LOW?"], "lime", 28, 22)} x={32} y={141} />
      <Cells draw={() => priceTag(["10,000", "BTC"])} x={120} y={201} />
    </>
  );
  return (
    <Stage
      scene={B1_SCENE}
      ui={
        <>
          <Txt text="TWO PIZZAS," x={90} y={24} k={2} shadow={INK} />
          <Txt text="LATER WORTH" x={90} y={44} k={2} shadow={INK} />
          <Txt text="$1.1 BILLION" x={90} y={66} k={2} box={tone("pink", 3)} color={tone("stone", 7)} />
          <Caption words={["TEN", "THOUSAND"]} hi={1} />
        </>
      }
    >
      <Reflect>{world}</Reflect>
      {world}
      <Steam x={92} y={140} cols={[-38, -12, 14, 38]} rise={58} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ b2 : Laszlo poste sur BitcoinTalk */

const B2_SCENE: Scene = {
  wall: tone("stone", 6),
  floor: tone("stone", 4),
  ambient: 0.46,
  mottle: 0.15,
  lamps: [{ kind: "top", power: 0.22 }, { kind: "cone", x: 96, top: -60, spread: 0.32, core: 22, power: 0.42, beam: 0 }, { kind: "glow", x: 116, y: 166, r: 46, power: 0.22 }],
  dust: 30,
  seed: 5,
};
const crtW = 46;
const B2: React.FC = () => {
  const frame = useCurrentFrame();
  const s = crtW / CRT.w;
  const [cx, cy] = [118 - Math.round((crtW + 2) / 2), 189 - (Math.round((crtW * CRT.h) / CRT.w) + 2)];
  return (
    <Stage
      scene={B2_SCENE}
      ui={
        <>
          <Cells
            draw={() => forumPost({ title: "PIZZA FOR BITCOINS?", author: "LASZLO", date: "MAY 18, 2010", body: "I'll pay 10,000 bitcoins for a couple of pizzas.. like maybe 2 large ones so I have some left over for the next day.", w: 152 })}
            x={14}
            y={30}
            outline="ink"
          />
          <Txt text="JACKSONVILLE, FL" x={90} y={131} box={tone("lime", 3)} color={INK} />
          <Caption words={["BITCOINTALK"]} hi={0} />
        </>
      }
    >
      <Cells draw={() => desk(92, 21)} x={64} y={GROUND} />
      <Cells draw={() => chair()} x={50} y={GROUND} />
      <Cells draw={() => keyboard(16)} x={62} y={189} />
      <Pix src={crtMonitor()} ramps={["stone", "ink", "lime"]} dither={0.45} w={crtW} x={118} y={189} />
      <Glow blur={10} strength={0.7}>
        <Cells draw={() => screenPage(Math.floor(CRT.screen[2] * s) - 3, Math.floor(CRT.screen[3] * s) - 3)} x={cx + 1 + Math.round(CRT.screen[0] * s) + 2} y={cy + 1 + Math.round(CRT.screen[1] * s) + 2} anchor="topleft" outline={false} />
      </Glow>
      <Cells draw={() => mug("pink")} x={146} y={189} />
      <Steam x={146} y={178} cols={[-1, 2]} rise={14} />
      <Cells draw={() => hdPerson(LASZLO, "type", frame)} deps={[Math.floor(frame / 3) % 2]} x={50} y={GROUND} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ b3 : 10 000 BTC = deux pizzas */

const B3_SCENE: Scene = {
  wall: tone("ink", 5),
  floor: tone("ink", 6),
  ambient: 0.16,
  lamps: [
    { kind: "cone", x: 46, top: -40, spread: 0.15, core: 8, power: 0.85, beam: 0.5 },
    { kind: "cone", x: 134, top: -40, spread: 0.15, core: 8, power: 0.85, beam: 0.5 },
  ],
  dust: 80,
  seed: 3,
};
const B3: React.FC = () => {
  const world = (
    <>
      <Pix src={coinStacks()} ramps={["orange", "stone"]} w={84} x={48} y={GROUND} />
      <Pix src={coinHero()} ramps={["orange", "stone"]} w={34} x={24} y={GROUND + 1} />
      <Pix src={pizzaBoxClosed()} mode ramps={["stone", "pink", "tomato", "orange"]} w={76} x={134} y={GROUND} />
      <Pix src={pizzaBoxClosed()} mode ramps={["stone", "pink", "tomato", "orange"]} w={76} x={135} y={GROUND - stack(76)} />
    </>
  );
  return (
    <Stage
      scene={B3_SCENE}
      ui={
        <>
          <Txt text="10,000 BTC" x={46} y={136} box={tone("orange", 3)} color={INK} />
          <Txt text="2 LARGE" x={134} y={136} box={PAPER} color={INK} />
          <Txt text="=" x={90} y={174} k={3} shadow={INK} />
          <Txt text="ABOUT $41" x={90} y={226} k={2} box={tone("pink", 3)} color={tone("stone", 7)} />
          <Caption words={["THE", "MATH:"]} hi={1} y={266} />
        </>
      }
    >
      <Reflect>{world}</Reflect>
      {world}
    </Stage>
  );
};

/* ------------------------------------------------------------------ b7 : la boîte s'ouvre */

const B7_SCENE: Scene = {
  wall: tone("stone", 5),
  floor: tone("wood", 3),
  ground: 222,
  ambient: 0.5,
  lamps: [{ kind: "cone", x: 90, top: -40, spread: 0.35, core: 20, power: 0.5, beam: 0.18 }, { kind: "top", power: 0.2 }],
  dust: 50,
  seed: 9,
};
const B7: React.FC = () => (
  <Stage
    scene={B7_SCENE}
    ui={
      <>
        <Cells
          draw={() => forumPost({ title: "RE: PIZZA FOR BITCOINS?", author: "LASZLO", date: "MAY 22, 2010", body: "I just want to report that I successfully traded 10,000 bitcoins for pizza.", w: 152 })}
          x={14}
          y={14}
          outline="ink"
        />
        <Caption words={["TRADED"]} hi={0} />
      </>
    }
  >
    <Pix src={pizzaBoxOpen()} ramps={["stone", "orange", "tomato", "lime", "wood"]} w={156} x={90} y={224} />
    <Steam x={90} y={190} cols={[-44, -18, 8, 34]} rise={56} />
  </Stage>
);

/* ------------------------------------------------------------------ b14 : caméo produit (vraie capture pixelisée) */

const B14_SCENE: Scene = {
  wall: tone("ink", 5),
  floor: tone("ink", 6),
  ambient: 0.18,
  lamps: [{ kind: "cone", x: 90, top: -40, spread: 0.3, core: 14, power: 0.7, beam: 0.4 }, { kind: "glow", x: 84, y: 128, r: 80, power: 0.35 }],
  dust: 70,
  seed: 21,
};
const B14: React.FC = () => {
  const world = (
    <>
      <Pix src={crtMonitor()} ramps={["stone", "ink", "lime"]} dither={0.45} w={140} x={90} y={GROUND} />
      <Glow blur={12} strength={0.3}>
        <Pix src={staticFile("apps/wheredgainsgo/dash-gas.png")} crop={[105, 900, 1005, 711]} w={89} h={63} x={38} y={100} anchor="topleft" outline={false} rim={false} dither={0.35} contrast={1.35} sat={1.2} />
      </Glow>
    </>
  );
  return (
    <Stage
      scene={B14_SCENE}
      ui={
        <>
          <Txt text="WHERE'D" x={90} y={18} k={2} shadow={INK} />
          <Txt text="GAINS GO?" x={90} y={38} k={2} shadow={INK} />
          <Txt text="WHEREDGAINSGO.FYI" x={90} y={60} box={tone("lime", 3)} color={INK} />
          <Caption words={["IN", "BURRITOS."]} hi={1} />
        </>
      }
    >
      <Reflect depth={30}>{world}</Reflect>
      {world}
    </Stage>
  );
};

/* ------------------------------------------------------------------ Planche */

const SCENES: [string, React.FC][] = [["b1", B1], ["b2", B2], ["b3", B3], ["b7", B7], ["b14", B14]];

const Sheet: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SCENES.map(([id, C], i) => (
      <div key={id} style={{ position: "absolute", left: i * 540, top: 0, width: 1080, height: 1920, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>
        <C />
      </div>
    ))}
  </AbsoluteFill>
);

/** Détail d'un plan agrandi (contrôle du pixel) : la zone carrée (x, y, size) en px, affichée en 720 × 720. */
const ZoomView: React.FC<{ scene: string; x: number; y: number; size: number }> = ({ scene, x, y, size }) => {
  const C = Object.fromEntries(SCENES)[scene];
  const k = 720 / size;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -x * k, top: -y * k, width: 1080, height: 1920, transform: `scale(${k})`, transformOrigin: "0 0" }}>
        <C />
      </div>
    </AbsoluteFill>
  );
};
const ZOOMS: [string, { scene: string; x: number; y: number; size: number }][] = [
  ["hd-zoom-b1", { scene: "b1", x: 120, y: 780, size: 480 }],
  ["hd-zoom-b2", { scene: "b2", x: 170, y: 860, size: 420 }],
  ["hd-zoom-b7", { scene: "b7", x: 200, y: 900, size: 520 }],
];

registerRoot(() => (
  <>
    {ZOOMS.map(([id, p]) => (
      <Composition key={id} id={id} component={ZoomView} defaultProps={p} durationInFrames={90} fps={30} width={720} height={720} />
    ))}
    {SCENES.map(([id, C]) => (
      <Composition key={id} id={`hd-${id}`} component={C} durationInFrames={90} fps={30} width={1080} height={1920} />
    ))}
    <Composition id="hd-sheet" component={Sheet} durationInFrames={90} fps={30} width={2700} height={960} />
  </>
));
