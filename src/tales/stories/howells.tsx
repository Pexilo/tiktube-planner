// Story d'exemple en pixel art (référence de qualité pour Claude) : les 8 000 BTC de James Howells dans la décharge de Newport.
// Un plan par beat, décor plein écran, personnages qui marchent, chaque apparition calée sur un mot via useBeat().at("mot").
// Grille : 90 colonnes × 160 lignes, sol à la ligne GROUND (105). Sous-titres et carte de fin : gérés par l'habillage.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Beat, City, Counter, Fly, GROUND, Hill, Label, PAL, Person, Pin, Prop, Room, Screen, Sky, Stamp, Street, Title, useBeat, useTale } from "../kit";
import type { StoryProps } from "../types";

/** b1 — Le hook : la décharge de nuit, et quelque part dedans, un disque dur. */
const Hook: React.FC = () => {
  const { tale } = useTale();
  const b = useBeat();
  return (
    <>
      <Sky kind="night" />
      <Hill kind="landfill" height={40} />
      <Title text={tale.hook} y={16} />
      <Counter value="$500,000,000+" y={47} at={b.at("half")} label="estimated value" />
      <Prop name="drive" x={45} y={90} at={b.at("hard")} anchor="center" />
      <Pin x={45} y={84} at={b.at("drive")} label="here?" />
    </>
  );
};

/** b2 — 2009 : James mine des bitcoins dans sa chambre ; les pièces s'empilent. */
const Mining: React.FC = () => {
  const b = useBeat();
  const coins = [0, 1, 2, 3, 4, 5];
  return (
    <>
      <Room window="night" />
      <Label x={45} y={16} text="2009 · Newport, Wales" color={PAL.lime} />
      <Prop name="desk" x={46} at={0} />
      <Prop name="computer" x={52} y={GROUND - 12} at={0} />
      <Prop name="chair" x={22} at={0} />
      <Person look="dev" x={24} pose="sit" at={b.at("James")} />
      {coins.map((i) => (
        <Fly key={i} name="coin" from={[52, 76]} to={[68 + (i % 3) * 6, 88 - Math.floor(i / 3) * 7]} at={b.at("mined") + i * 5} dur={12} arc={8} />
      ))}
      <Counter value="8,000 BTC" y={40} at={b.at("eight")} color={PAL.btc} />
      <Label x={45} y={52} at={b.at("nothing")} text="worth ≈ $0" />
    </>
  );
};

/** b3 — 2013 : le disque dur part à la poubelle, puis le camion l'emporte. */
const ToTheTip: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const drop = b.at("bag") + 4;
  return (
    <>
      <Sky kind="night" />
      <City />
      <Street />
      <Label x={45} y={16} text="2013 · the clear-out" color={PAL.lime} />
      <Prop name="bin" x={56} at={0} />
      <Person look="dev" x={-10} to={42} dur={Math.max(20, drop - 6)} hold={frame < drop ? "drive" : undefined} pose="shrug" />
      <Fly name="drive" from={[48, 76]} to={[56, 88]} at={drop} dur={8} vanish />
      <Fly name="truck" from={[112, 92]} to={[-40, 92]} at={b.at("tip") - 8} dur={46} flip={false} />
    </>
  );
};

/** b4 — Le twist : la seule copie des clés privées était sur ce disque. */
const NoBackup: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Sky kind="void" />
      <Screen x={8} y={18} w={74} h={36} at={0} title="wallet.dat" lines={["> PRIVATE KEYS: 1 COPY", "> LOCATION: THAT DRIVE", "> BACKUP: NONE"]} />
      <Prop name="drive" x={36} y={84} at={b.at("drive")} anchor="center" />
      <Fly name="key" from={[70, 70]} to={[46, 84]} at={b.at("keys")} dur={10} />
      <Stamp y={100} at={b.at("backup")} text="NO BACKUP" />
    </>
  );
};

/** b5 — Dix ans de demandes au conseil municipal : drones, chiens robots, investisseurs… refusé. */
const Denied: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Sky kind="day" />
      <City kind="day" />
      <Street />
      <Label x={45} y={16} text="2013 → 2024 · Newport council" color={PAL.lime} />
      <Prop name="bank" x={62} at={b.at("council")} />
      <Person look="dev" x={-6} to={30} dur={36} />
      <Fly name="drone" from={[-12, 44]} to={[24, 44]} at={b.at("drones")} dur={16} />
      <Prop name="robotdog" x={14} at={b.at("robot")} />
      <Prop name="bag" x={40} at={b.at("investors")} />
      <Stamp y={62} at={b.at("no")} text="DENIED" />
    </>
  );
};

/** b6 — Janvier 2025 : la plainte est rejetée ; les pièces restent sous terre. */
const StillBuried: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Sky kind="dusk" />
      <Hill kind="landfill" height={34} />
      <Label x={45} y={16} text="January 2025" color={PAL.lime} />
      <Prop name="gavel" x={45} y={40} anchor="center" at={b.at("judge")} />
      <Label x={45} y={52} at={b.at("claim")} text="claim struck out" color={PAL.pink} textColor={PAL.ink} />
      <Fly name="coin" from={[38, 78]} to={[38, 96]} at={b.at("still")} dur={30} />
      <Fly name="coin" from={[50, 80]} to={[50, 98]} at={b.at("still") + 6} dur={30} />
      <Stamp y={66} at={b.at("reach")} text="STILL BURIED" color={PAL.lime} />
    </>
  );
};

/** b8 — Outro : la décharge la nuit, l'histoire n'est pas finie. */
const Outro: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Sky kind="night" />
      <Hill kind="landfill" height={40} />
      <Person look="dev" x={20} to={-20} dur={70} at={0} />
      <Pin x={50} y={78} at={b.at("next")} label="?" />
      <Label x={45} y={40} at={b.at("believe")} text="to be continued" color={PAL.lime} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1">
      <Hook />
    </Beat>
    <Beat id="b2">
      <Mining />
    </Beat>
    <Beat id="b3">
      <ToTheTip />
    </Beat>
    <Beat id="b4">
      <NoBackup />
    </Beat>
    <Beat id="b5">
      <Denied />
    </Beat>
    <Beat id="b6">
      <StillBuried />
    </Beat>
    {/* b7 = moment produit : dessiné par l'habillage (TaleVideo), rien ici. */}
    <Beat id="b8">
      <Outro />
    </Beat>
  </>
);
