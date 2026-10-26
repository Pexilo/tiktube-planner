// Story d'exemple en pixel art (référence de qualité pour Claude) : les 8 000 BTC de James Howells dans la décharge de Newport.
// Un plan par beat (le dernier boucle sur le premier : <Beat loop>) : un fond aplat éclairé de la palette (<Beat bg light ambient>), un élément principal, des détails qui vivent
// (onde, étincelles, flux d'icônes), 1 ou 2 infos, chaque mouvement calé sur un mot. Personnage seulement quand quelqu'un agit.
// Grille : 90 colonnes × 160 lignes, sol à la ligne GROUND (105). Échelle : un personnage = 20 cellules ≈ 1,70 m.
// Prop / Move = objets du monde à l'échelle ; Icon / Fly / Tile / Flow = symboles. Sous-titres et fin : l'habillage.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Beat, Counter, Flow, Fly, GROUND, Icon, Label, Mound, Move, PAL, Person, Pin, Prop, Pulse, Screen, Skyline, Sparkle, Stamp, Tile, Title, useBeat, useTale } from "../kit";
import type { StoryProps } from "../types";

/** b1 — Le hook : une décharge dans la nuit, et quelque part dedans, un disque dur qui « appelle ». Pas de personnage. */
const Hook: React.FC = () => {
  const { tale } = useTale();
  const b = useBeat();
  return (
    <>
      <Mound w={72} h={30} />
      <Title text={tale.hook} y={16} />
      <Counter value="$500,000,000+" y={46} at={b.at("half")} label="estimated value" />
      <Pulse x={45} y={92} at={b.at("hard")} />
      <Icon name="drive" x={45} y={92} at={b.at("hard")} />
      <Pin x={45} y={84} at={b.at("drive")} label="here?" />
    </>
  );
};

/** b2 — 2009 : James mine des bitcoins à son bureau ; les pièces s'envolent de l'écran et scintillent. */
const Mining: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Label x={45} y={16} text="2009 · Newport, Wales" color={PAL.lime} />
      <Prop name="desk" x={52} />
      <Prop name="computer" x={55} y={GROUND - 9} />
      <Prop name="chair" x={40} />
      <Person look="dev" x={41} pose="sit" at={b.at("James")} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Fly key={i} name="coin" from={[55, 88]} to={[44 + (i % 3) * 15, 78 - Math.floor(i / 3) * 15]} at={b.at("mined") + i * 5} dur={12} arc={6} />
      ))}
      <Sparkle x={58} y={60} at={b.at("eight")} />
      <Sparkle x={70} y={56} at={b.at("eight") + 6} phase={2} />
      <Counter value="8,000 BTC" y={38} at={b.at("eight")} color={PAL.btc} />
      <Label x={45} y={50} at={b.at("nothing")} text="worth ≈ $0" />
    </>
  );
};

/** b3 — 2013 : sous un réverbère, le disque dur part à la poubelle, puis le camion l'emporte. */
const ToTheTip: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const drop = b.at("bag") + 4;
  return (
    <>
      <Skyline />
      <Label x={45} y={16} text="2013 · the clear-out" color={PAL.lime} />
      <Prop name="lamp" x={46} />
      <Prop name="bin" x={58} />
      <Person look="dev" x={-10} to={50} dur={Math.max(20, drop - 6)} hold={frame < drop ? "drive" : undefined} />
      <Move name="drive" from={[55, GROUND - 9]} to={[58, GROUND - 11]} at={drop} dur={6} vanish />
      <Pulse x={58} y={GROUND - 6} at={drop + 6} max={9} />
      <Move name="truck" from={[130, GROUND]} to={[-60, GROUND]} at={b.at("tip") - 8} dur={50} />
    </>
  );
};

/** b4 — Le twist, sans personnage : le terminal, puis le flux clés → disque → aucune sauvegarde. */
const NoBackup: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Screen x={8} y={18} w={74} h={26} at={0} title="wallet.dat" lines={["> PRIVATE KEYS: 1 COPY", "> BACKUP: NONE"]} />
      <Flow
        y={78}
        items={[
          { icon: "px-key", label: "private keys", at: b.at("keys") },
          { icon: "drive", label: "that drive", at: b.at("drive") },
          { icon: "cross", label: "no backup", at: b.at("backup") },
        ]}
      />
    </>
  );
};

/** b5 — Dix ans de demandes au conseil : ses idées en tuiles, puis le refus. Pas de personnage. */
const Denied: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Label x={45} y={16} text="2013 → 2024 · Newport council" />
      <Prop name="bank" x={45} at={b.at("council")} />
      <Flow
        y={38}
        arrows={false}
        items={[
          { icon: "signal", label: "drones", at: b.at("drones") },
          { icon: "px-robot", label: "robot dogs", at: b.at("robot") },
          { icon: "px-briefcase", label: "investors", at: b.at("investors") },
        ]}
      />
      <Stamp y={76} at={b.at("no")} text="DENIED" />
    </>
  );
};

/** b6 — Janvier 2025 : le marteau tombe ; les pièces s'enfoncent dans le tas. */
const StillBuried: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Mound w={64} h={26} />
      <Label x={45} y={16} text="January 2025" />
      <Pulse x={45} y={36} at={b.at("judge")} color={PAL.paper} max={16} />
      <Tile icon="gavel" x={45} y={36} at={b.at("judge")} label="claim struck out" />
      <Fly name="coin" from={[38, 76]} to={[38, 96]} at={b.at("still")} dur={30} />
      <Fly name="coin" from={[52, 78]} to={[52, 98]} at={b.at("still") + 6} dur={30} />
      <Stamp y={66} at={b.at("reach")} text="STILL BURIED" color={PAL.lime} />
    </>
  );
};

/**
 * b8 — Outro qui boucle : le même plan que le hook (même tas), James s'en va, le disque « appelle » encore sous le tas.
 * Après le dernier mot, le kit revient sur la frame 0 du hook : la phrase continue sur « Somewhere under this landfill… ».
 */
const Outro: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Mound w={72} h={30} />
      <Person look="dev" x={34} to={-12} dur={Math.max(30, b.end)} />
      <Pulse x={45} y={92} at={b.at("dig")} />
      <Sparkle x={38} y={84} at={b.at("allowed")} />
      <Sparkle x={54} y={86} at={b.at("allowed") + 4} phase={2} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1" bg="ink" light="glow" ambient="dust">
      <Hook />
    </Beat>
    <Beat id="b2" bg="deep" light="top">
      <Mining />
    </Beat>
    <Beat id="b3" bg="ink" light="spot">
      <ToTheTip />
    </Beat>
    <Beat id="b4" bg="ink" floor={false} light="glow" ambient="sparks">
      <NoBackup />
    </Beat>
    <Beat id="b5" bg="cyan" light="top">
      <Denied />
    </Beat>
    <Beat id="b6" bg="pink" light="spot" ambient="sparks">
      <StillBuried />
    </Beat>
    {/* b7 = moment produit : dessiné par l'habillage (TaleVideo), rien ici. */}
    {/* Dernier plan : il boucle sur le premier (même fond, puis la frame 0 du hook). */}
    <Beat id="b8" loop>
      <Outro />
    </Beat>
  </>
);
