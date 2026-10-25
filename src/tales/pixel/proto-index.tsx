// Planches de référence du style pixel (entrée Remotion isolée) : le casting (marche + poses) et tous les objets.
// Rendu : npx remotion still src/tales/pixel/proto-index.tsx pixel-sheet out/pixel/sheet.png (idem pixel-props).
import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { COLS, LOOKS, PAL, Person, type LookName } from "./engine";
import { Label, Prop, PROP_NAMES, propSize, Sky } from "./props";

const Cast: React.FC = () => {
  const names = Object.keys(LOOKS) as LookName[];
  return (
    <AbsoluteFill>
      <Sky kind="office" />
      {names.map((n, i) => {
        const x = 12 + (i % 4) * 22;
        const y = 44 + Math.floor(i / 4) * 46;
        return (
          <React.Fragment key={n}>
            <Person look={n} x={x} y={y} at={-(i * 3)} to={400} dur={99999} />
            <Label x={x} y={y + 4} text={n} size={22} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const Props: React.FC = () => {
  let x = 2;
  let y = 6;
  let rowH = 0;
  const placed = PROP_NAMES.map((n) => {
    const { w, h } = propSize(n);
    if (x + w + 2 > COLS) {
      x = 2;
      y += rowH + 6;
      rowH = 0;
    }
    const pos = { n, x: x + Math.floor(w / 2) + 1, y: y + h + 1 };
    x += w + 4;
    rowH = Math.max(rowH, h);
    return pos;
  });
  return (
    <AbsoluteFill style={{ background: PAL.ink2 }}>
      {placed.map((p) => (
        <React.Fragment key={p.n}>
          <Prop name={p.n} x={p.x} y={p.y} />
          <Label x={p.x} y={p.y + 3} text={p.n} size={20} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <>
    <Composition id="pixel-sheet" component={Cast} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="pixel-props" component={Props} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);
registerRoot(Root);
