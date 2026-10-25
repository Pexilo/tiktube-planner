// Story d'exemple (référence de qualité pour Claude) : les 8 000 BTC de James Howells dans la décharge de Newport.
// Une scène par beat, chaque apparition calée sur un mot de la voix off via useBeat().at("mot").
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  Actor,
  Appear,
  Arrow,
  Beat,
  Board,
  Chain,
  Coin,
  Counter,
  CYAN,
  GREY,
  Icon,
  INK,
  InkPath,
  LIME,
  ORANGE,
  PAPER,
  PAPER_2,
  PINK,
  Pin,
  Redacted,
  Stamp,
  Tag,
  Timeline,
  Title,
  Transfer,
  useBeat,
  useTale,
} from "../kit";
import type { StoryProps } from "../types";

/** Monticule de la décharge (réutilisé dans plusieurs beats). */
const MOUND = "M 40 1000 C 180 760 330 700 500 690 C 680 690 820 760 960 1000 Z";
const Landfill: React.FC<{ at: number; junk?: boolean }> = ({ at, junk = true }) => (
  <>
    <InkPath d={MOUND} at={at} dur={22} width={7} fill={PAPER_2} />
    {junk ? (
      <>
        <Icon name="trash" x={300} y={820} at={at + 10} size={90} rot={-12} />
        <Icon name="document" x={680} y={790} at={at + 14} size={80} rot={14} />
        <Icon name="phone" x={540} y={900} at={at + 18} size={70} rot={-30} />
        <Icon name="laptop" x={790} y={900} at={at + 22} size={80} rot={8} />
      </>
    ) : null}
  </>
);

const Hook: React.FC = () => {
  const { tale } = useTale();
  const b = useBeat();
  return (
    <>
      <Title x={500} y={140} at={0} text={tale.hook} size={112} />
      <Landfill at={4} />
      <Appear at={b.at("hard")} from="scale">
        <Icon name="harddrive" x={430} y={900} size={120} box={PINK} rot={-6} />
      </Appear>
      <Pin x={430} y={830} at={b.at("drive")} label="here?" />
      <Counter x={500} y={470} at={b.at("half")} value="$500,000,000+" size={118} color={PAPER} label="estimated value" />
    </>
  );
};

const Mining: React.FC = () => {
  const b = useBeat();
  return (
    <Board label="2009 · Newport, Wales" tag="Case file">
      <Actor x={210} y={560} at={b.at("James")} kind="dev" label="James H. · IT engineer" color={CYAN} />
      <Chain x={400} y={190} at={b.at("mined") - 4} count={4} first={1} size={100} label="bitcoin blocks" stagger={4} />
      <Transfer from={[560, 300]} to={[250, 610]} at={b.at("mined") + 6} dur={26} amount="+50 BTC" bend={50} />
      <Transfer from={[860, 300]} to={[250, 610]} at={b.at("eight") - 4} dur={26} bend={70} />
      <Counter x={680} y={640} at={b.at("eight")} value="8,000 BTC" size={120} />
      <Tag x={760} y={760} at={b.at("nothing")} color={LIME}>worth ≈ $0</Tag>
    </Board>
  );
};

const ToTheTip: React.FC = () => {
  const b = useBeat();
  const steps: { icon: "harddrive" | "trash" | "truck"; word: string; label: string }[] = [
    { icon: "harddrive", word: "drive", label: "hard drive" },
    { icon: "trash", word: "bag", label: "bin bag" },
    { icon: "truck", word: "tip", label: "to the tip" },
  ];
  return (
    <Board label="2013 · the clear-out" tag="Case file">
      <Timeline x={140} y={150} w={720} at={0} items={[{ label: "2009", sub: "mined" }, { label: "2013", sub: "clear-out" }]} active={1} />
      {steps.map((s, i) => (
        <React.Fragment key={s.icon}>
          <Icon name={s.icon} x={190 + i * 310} y={470} at={b.at(s.word) - 3} size={170} box={i === 0 ? PINK : PAPER} />
          <Tag x={190 + i * 310} y={600} at={b.at(s.word) + 2} color={PAPER}>{s.label}</Tag>
          {i > 0 ? <Arrow from={[290 + (i - 1) * 310, 470]} to={[100 + i * 310, 470]} at={b.at(s.word) - 10} dur={10} /> : null}
        </React.Fragment>
      ))}
      <Pin x={810} y={860} at={b.at("tip") + 6} label="Newport landfill" />
      <InkPath d="M 620 960 C 700 860 900 860 980 960" at={b.at("tip") + 2} dur={14} width={6} fill={PAPER_2} />
    </Board>
  );
};

const NoBackup: React.FC = () => {
  const b = useBeat();
  return (
    <Board tone="ink" label="evidence #1" tag="Keys" shadow={CYAN}>
      <Icon name="harddrive" x={500} y={300} at={0} size={260} color={PAPER} />
      <Icon name="key" x={500} y={300} at={b.at("keys")} size={110} box={LIME} rot={-10} />
      <Redacted x={150} y={520} w={700} at={b.at("private")} lines={3} color={PAPER} />
      <Stamp x={500} y={820} at={b.at("backup")} text="No backup" size={84} color={PINK} />
    </Board>
  );
};

const Denied: React.FC = () => {
  const b = useBeat();
  const ideas: { icon: "plane" | "search" | "dollar"; word: string; label: string; x: number; y: number }[] = [
    { icon: "plane", word: "drones", label: "drones", x: 200, y: 300 },
    { icon: "search", word: "robot", label: "robot dogs", x: 500, y: 240 },
    { icon: "dollar", word: "investors", label: "investors", x: 800, y: 300 },
  ];
  return (
    <Board label="2013 → 2024 · Newport City Council" tag="Requests">
      <Icon name="building" x={500} y={620} at={b.at("council")} size={190} box={PAPER} />
      <Tag x={500} y={750} at={b.at("council") + 4} color={PAPER}>city council</Tag>
      <Actor x={140} y={760} at={0} kind="person" label="James" color={CYAN} size={0.8} />
      {ideas.map((it) => (
        <React.Fragment key={it.label}>
          <Icon name={it.icon} x={it.x} y={it.y} at={b.at(it.word)} size={130} box={LIME} />
          <Tag x={it.x} y={it.y + 100} at={b.at(it.word) + 3} color={PAPER}>{it.label}</Tag>
          <Arrow from={[it.x, it.y + 130]} to={[500, 520]} at={b.at(it.word) + 6} dur={10} dashed color={GREY} />
        </React.Fragment>
      ))}
      <Stamp x={500} y={900} at={b.at("no")} text="Denied" size={96} color={PINK} rot={-10} />
    </Board>
  );
};

const StillBuried: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const sink = Math.min(1, Math.max(0, (frame - b.at("still")) / 40));
  return (
    <>
      <Timeline x={120} y={110} w={760} at={0} items={[{ label: "2013" }, { label: "2025", sub: "claim struck out" }]} active={1} />
      <Icon name="gavel" x={500} y={330} at={b.at("judge")} size={190} box={PAPER} rot={-8} />
      <Landfill at={0} junk={false} />
      <div style={{ position: "absolute", left: 470, top: 760 + sink * 120 }}>
        <Coin size={110} />
        <div style={{ position: "absolute", left: 40, top: -30 }}>
          <Coin size={90} color={ORANGE} />
        </div>
      </div>
      <Stamp x={500} y={560} at={b.at("reach")} text="Still buried" size={78} color={LIME} rot={-6} />
    </>
  );
};

const Outro: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Board x={80} y={180} w={840} h={560} tone="ink" label="case closed?" tag="Crypto stories" shadow={LIME}>
        <Icon name="question" x={420} y={250} at={6} size={260} color={PAPER} />
      </Board>
      <Icon name="harddrive" x={500} y={900} at={b.at("next")} size={110} box={PINK} rot={8} />
      <InkPath d="M 300 1000 C 380 880 620 880 700 1000" at={0} dur={16} width={6} color={PAPER} />
      <Tag x={500} y={820} at={b.at("believe")} color={PAPER} textColor={INK}>to be continued</Tag>
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
