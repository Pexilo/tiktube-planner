// Planches de référence du style pixel (entrée Remotion isolée) : le casting, les objets du monde (à côté d'un personnage,
// pour vérifier l'échelle) et les icônes.
// Rendu : npx remotion still src/tales/pixel/proto-index.tsx pixel-sheet out/pixel/sheet.png (idem pixel-props, pixel-icons).
import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { COLS, LOOKS, PAL, Person, type LookName, type Pose } from "./engine";
import { Backdrop, type Ambient, type Light, type Tone } from "./backdrop";
import { measure } from "./font";
import { Icon, ICON_NAMES, iconSize, Label, Prop, PROP_NAMES, propSize, Tile } from "./props";

const Cast: React.FC = () => {
  const names = Object.keys(LOOKS) as LookName[];
  const poses: Pose[] = ["idle", "cheer", "point", "shrug"];
  return (
    <AbsoluteFill>
      <Backdrop tone="deep" floor={false} />
      {names.map((n, i) => {
        const x = 8 + (i % 5) * 17;
        const y = 30 + Math.floor(i / 5) * 30;
        return (
          <React.Fragment key={n}>
            <Person look={n} x={x} y={y} at={-(i * 3)} to={400} dur={99999} />
            <Label x={x} y={y + 3} text={n} />
          </React.Fragment>
        );
      })}
      {poses.map((p, i) => (
        <React.Fragment key={p}>
          <Person look="dev" x={10 + i * 20} y={100} pose={p} />
          <Label x={10 + i * 20} y={103} text={p} />
        </React.Fragment>
      ))}
      <Prop name="chair" x={86} y={100} />
      <Person look="founder" x={86} y={100} pose="sit" />
    </AbsoluteFill>
  );
};

/** Objets du monde rangés sur des sols, avec un personnage de référence sur chaque ligne (échelle). */
const World: React.FC = () => {
  const rows: { y: number; items: { n: (typeof PROP_NAMES)[number]; x: number }[] }[] = [];
  let x = 14;
  let row: (typeof rows)[number] = { y: 52, items: [] };
  for (const n of PROP_NAMES) {
    const { w } = propSize(n);
    if (x + w > COLS - 2) {
      rows.push(row);
      row = { y: row.y + 54, items: [] };
      x = 14;
    }
    row.items.push({ n, x: x + Math.floor(w / 2) });
    x += w + 4;
  }
  rows.push(row);
  return (
    <AbsoluteFill style={{ background: PAL.ink2 }}>
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          <Backdrop tone="ink" ground={r.y} />
          <Person look="dev" x={5} y={r.y} />
          {r.items.map((it) => (
            <React.Fragment key={it.n}>
              <Prop name={it.n} x={it.x} y={r.y} />
              <Label x={it.x} y={r.y + 3} text={it.n} />
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

const Icons: React.FC<{ page: number }> = ({ page }) => {
  // Deux pages : chaque icône prend la largeur de son étiquette, pour que rien ne se chevauche.
  let x = 3;
  let y = 6;
  let rowH = 0;
  const all = ICON_NAMES.filter((n) => !n.startsWith("px-")).map((n) => {
    const { w, h } = iconSize(n);
    const span = Math.max(w + 2, Math.ceil(measure(n).wCells) + 3);
    if (x + span > COLS - 2) {
      x = 3;
      y += rowH + 10;
      rowH = 0;
    }
    const pos = { n, x: x + Math.floor(span / 2), y: y + Math.floor(h / 2) + 1, page: y > 140 ? 1 : 0 };
    x += span + 2;
    rowH = Math.max(rowH, h);
    return pos;
  });
  const shift = page === 1 ? Math.min(...all.filter((p) => p.page === 1).map((p) => p.y)) - 10 : 0;
  return (
    <AbsoluteFill style={{ background: PAL.ink2 }}>
      {all
        .filter((p) => p.page === page)
        .map((p) => (
          <React.Fragment key={p.n}>
            <Icon name={p.n} x={p.x} y={p.y - shift} />
            <Label x={p.x} y={p.y - shift + 10} text={p.n} />
          </React.Fragment>
        ))}
    </AbsoluteFill>
  );
};

/** Icônes fines (px-…, pixelarticons) : 4 par ligne, 24 par page ; la dernière ligne les montre en tuiles sur fond clair. */
const FineIcons: React.FC<{ page: number }> = ({ page }) => {
  const names = ICON_NAMES.filter((n) => n.startsWith("px-")).slice(page * 24, page * 24 + 24);
  return (
    <AbsoluteFill>
      <Backdrop tone="ink" floor={false} />
      {names.map((n, i) => {
        const x = 12 + (i % 4) * 22;
        const y = 12 + Math.floor(i / 4) * 19;
        return (
          <React.Fragment key={n}>
            <Icon name={n} x={x} y={y} />
            <Label x={x} y={y + 10} text={n.slice(3)} slot={false} />
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 0, top: 125 * 12, width: 1080, height: 35 * 12, background: PAL.cyan }} />
      {names.slice(0, 4).map((n, i) => (
        <Tile key={n} icon={n} x={12 + i * 22} y={138} label={n.slice(3)} />
      ))}
    </AbsoluteFill>
  );
};

/** Test d'éclairage : un fond, un type de lumière, des particules (props), avec un personnage et une icône pour juger. */
const LightTest: React.FC<{ tone: Tone; light: Light; ambient: Ambient }> = ({ tone, light, ambient }) => (
  <AbsoluteFill>
    <Backdrop tone={tone} light={light} ambient={ambient} />
    <Person look="dev" x={COLS / 2} y={105} />
    <Icon name="coin" x={COLS / 2} y={60} />
  </AbsoluteFill>
);

const Root: React.FC = () => (
  <>
    <Composition id="pixel-light" component={LightTest} durationInFrames={60} fps={30} width={1080} height={1920} defaultProps={{ tone: "ink" as Tone, light: "glow" as Light, ambient: "dust" as Ambient }} />
    <Composition id="pixel-sheet" component={Cast} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="pixel-props" component={World} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="pixel-icons" component={Icons} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{ page: 0 }} />
    <Composition id="pixel-fine" component={FineIcons} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{ page: 0 }} />
    <Composition id="pixel-icons-2" component={Icons} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{ page: 1 }} />
  </>
);
registerRoot(Root);
