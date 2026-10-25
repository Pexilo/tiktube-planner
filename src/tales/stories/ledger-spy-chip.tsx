// Story : la puce espionne cachée dans des Ledger vendus par CryptoBilis (octobre 2026).
// Une scène par beat, chaque apparition calée sur un mot de la voix off via useBeat().at("mot").
import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import {
  Actor,
  Appear,
  Arrow,
  Beat,
  Board,
  Callout,
  Coin,
  Counter,
  CYAN,
  GREY,
  Icon,
  INK,
  InkPath,
  LIME,
  monoStyle,
  Note,
  PAPER,
  PAPER_2,
  PINK,
  Pin,
  Stamp,
  Tag,
  Title,
  useBeat,
  useEnter,
  useTale,
} from "../legacy";
import type { StoryProps } from "../types";

const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Wallet matériel schématique (boîtier papier, écran encre, deux boutons). Le contenu de l'écran est en coordonnées écran. */
const Device: React.FC<{ x: number; y: number; w: number; h: number; at?: number; shadow?: string; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  at = 0,
  shadow = PINK,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 13, stiffness: 190 });
  if (frame < at) return null;
  const pad = Math.round(Math.min(w, h) * 0.09);
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `translateY(${(1 - p) * 90}px) scale(${0.85 + 0.15 * p})`, opacity: Math.min(1, p * 2) }}>
      {[0.22, 0.62].map((f) => (
        <div key={f} style={{ position: "absolute", left: w * f, top: -16, width: w * 0.16, height: 22, background: PAPER_2, border: `5px solid ${INK}` }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: PAPER_2, border: `6px solid ${INK}`, borderRadius: 22, boxShadow: `12px 12px 0 ${shadow}` }} />
      <div style={{ position: "absolute", left: pad, top: pad, right: pad, bottom: pad, background: INK, borderRadius: 8, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/** Puce vue de dessus : carré coloré, pattes sur les 4 côtés. */
const Chip: React.FC<{ size: number; color: string; children?: React.ReactNode }> = ({ size, color, children }) => {
  const pins = [0.2, 0.4, 0.6, 0.8];
  const leg = size * 0.14;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {pins.map((f) => (
          <g key={f} stroke={INK} strokeWidth={5} strokeLinecap="round">
            <line x1={size * f} y1={-leg} x2={size * f} y2={0} />
            <line x1={size * f} y1={size} x2={size * f} y2={size + leg} />
            <line x1={-leg} y1={size * f} x2={0} y2={size * f} />
            <line x1={size} y1={size * f} x2={size + leg} y2={size * f} />
          </g>
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, background: color, border: `5px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
};

/** Barre caviardée d'un mot de la phrase de récupération. */
const Bar: React.FC<{ w: number; color?: string }> = ({ w, color = PAPER }) => <span style={{ display: "inline-block", width: w, height: 24, background: color, verticalAlign: "middle" }} />;

const Hook: React.FC = () => {
  const { tale } = useTale();
  const b = useBeat();
  const frame = useCurrentFrame();
  const texting = b.at("texting");
  const seed = b.at("seed");
  return (
    <>
      <Title x={500} y={165} at={0} text={tale.hook} size={96} />
      <Device x={250} y={780} w={360} h={240} at={2}>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <Icon name={frame < texting ? "lock" : "unlock"} size={110} color={frame < texting ? LIME : PINK} at={frame < texting ? 4 : texting} />
        </div>
      </Device>
      <Tag x={250} y={960} at={b.at("offline")} color={CYAN} size={20}>built to stay offline</Tag>
      <Appear at={b.at("instead")} from="scale" style={{ position: "absolute", left: 650, top: 640, width: 320, height: 320, borderRadius: "50%", background: PAPER_2, border: `6px solid ${INK}`, boxShadow: `10px 10px 0 ${PINK}` }}>
        {null}
      </Appear>
      <Actor x={810} y={790} at={b.at("instead")} kind="hacker" size={1.1} />
      <Arrow from={[460, 720]} to={[660, 760]} at={texting} dur={16} bend={-70} color={PINK} dashed />
      <Appear at={texting} from="scale" style={{ position: "absolute", left: 430, top: 400, width: 420 }}>
        <div style={{ background: PAPER, border: `5px solid ${INK}`, boxShadow: `8px 8px 0 ${PINK}`, transform: "rotate(-3deg)" }}>
          <div style={{ background: INK, padding: "8px 14px", ...monoStyle(16, LIME) }}>new message · sms</div>
          <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
            {[150, 210, 120].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, ...monoStyle(18, GREY), opacity: frame >= seed + i * 4 ? 1 : 0 }}>
                {String(i + 1).padStart(2, "0")} <Bar w={w} color={INK} />
              </div>
            ))}
          </div>
        </div>
      </Appear>
      <Tag x={810} y={990} at={b.at("stranger")} color={PINK} size={22}>a stranger</Tag>
    </>
  );
};

/** Asie du Sud-Est stylisée (péninsule + îles), en traits d'encre. */
const MAP = [
  "M 160 60 L 470 50 L 520 120 L 500 210 L 450 260 L 420 330 L 380 290 L 360 330 L 330 360 L 345 420 L 370 470 L 340 480 L 305 410 L 300 330 L 270 250 L 210 200 L 150 140 Z",
  "M 270 430 L 310 440 L 400 540 L 380 560 L 300 500 Z",
  "M 520 380 C 560 330 650 330 670 390 C 690 450 630 500 570 490 C 520 480 500 430 520 380 Z",
  "M 420 565 L 600 575 L 595 595 L 420 585 Z",
  "M 640 120 L 690 110 L 700 210 L 665 230 Z",
  "M 690 250 L 740 240 L 750 310 L 700 320 Z",
  "M 720 380 L 760 370 L 750 430 L 790 460 L 740 470 L 720 430 Z",
];

const Reseller: React.FC = () => {
  const b = useBeat();
  const nodes: { icon: "shield" | "building" | "person"; at: number; label: string; box: string }[] = [
    { icon: "shield", at: b.at("ledger"), label: "Ledger", box: CYAN },
    { icon: "building", at: b.at("cryptobilis") - 4, label: "CryptoBilis", box: PINK },
    { icon: "person", at: b.at("reseller") + 6, label: "buyer", box: PAPER },
  ];
  return (
    <Board label="where the devices came from" tag="Supply chain">
      {MAP.map((d, i) => (
        <InkPath key={i} d={d} at={2 + i * 3} dur={22} width={5} fill={PAPER_2} />
      ))}
      <Pin x={500} y={300} at={b.at("cryptobilis")} label="CryptoBilis · reseller" />
      <Tag x={760} y={560} at={b.at("southeast")} color={LIME} size={22} rot={-3}>Southeast Asia</Tag>
      {nodes.map((n, i) => (
        <React.Fragment key={n.label}>
          <Icon name={n.icon} x={170 + i * 330} y={790} at={n.at} size={150} box={n.box} />
          <Tag x={170 + i * 330} y={910} at={n.at + 3} color={PAPER} size={20}>{n.label}</Tag>
        </React.Fragment>
      ))}
      <Arrow from={[265, 790]} to={[400, 790]} at={b.at("sold")} dur={14} />
      <Tag x={332} y={720} at={b.at("devices")} color={LIME} size={18}>devices</Tag>
      <Arrow from={[595, 790]} to={[730, 790]} at={b.at("reseller")} dur={14} />
      <Tag x={662} y={720} at={b.at("reseller") + 4} color={LIME} size={18}>sold</Tag>
    </Board>
  );
};

const Teardown: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [b.at("case"), b.at("case") + 20], [0, 1], clampOpt);
  return (
    <Board tone="ink" label="teardown · schematic" tag="Evidence" shadow={CYAN}>
      {/* Carte électronique */}
      <div style={{ position: "absolute", left: 120, top: 330, width: 760, height: 400, background: PAPER_2, border: `6px solid ${PAPER}`, borderRadius: 18 }} />
      <InkPath d="M 330 470 L 330 400 L 560 400 M 400 530 L 620 530 L 620 640 M 270 600 L 200 600 L 200 680" at={4} dur={24} width={5} color={GREY} />
      <div style={{ position: "absolute", left: 260, top: 450 }}>
        <Chip size={140} color={CYAN} />
      </div>
      <Tag x={330} y={650} at={6} color={PAPER} size={16}>secure element</Tag>
      {/* Boîtier qui se soulève */}
      <div style={{ position: "absolute", left: 100, top: 310 - lift * 250, width: 800, height: 440 - lift * 300, background: PAPER, border: `6px solid ${INK}`, borderRadius: 22, boxShadow: `10px 10px 0 ${PINK}`, display: "grid", placeItems: "center" }}>
        <span style={monoStyle(22, INK)}>case</span>
      </div>
      <Appear at={b.at("hidden")} from="drop" style={{ position: "absolute", left: 640, top: 440 }}>
        <Chip size={130} color={PINK}>
          <Icon name="eye" size={70} />
        </Chip>
      </Appear>
      <Callout x={560} y={860} to={[690, 600]} at={b.at("extra")} text="unauthorized" color={PINK} />
      <Tag x={705} y={410} at={b.at("chip")} color={LIME} size={20}>extra chip</Tag>
      <InkPath d="M 785 545 L 805 545 L 805 600" at={b.at("esim")} dur={8} width={5} color={INK} />
      <Appear at={b.at("esim")} from="scale" style={{ position: "absolute", left: 770, top: 600 }}>
        <div style={{ width: 76, height: 56, background: LIME, border: `5px solid ${INK}`, borderTopRightRadius: 18, boxShadow: `5px 5px 0 ${INK}` }} />
      </Appear>
      <Tag x={810} y={700} at={b.at("esim") + 3} color={LIME} size={20}>its own eSIM</Tag>
    </Board>
  );
};

const Exfil: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const words = b.at("twenty");
  const read = b.at("read");
  const sent = b.at("sent");
  const beam = interpolate(frame, [read, read + 6, sent + 10, sent + 20], [0, 0.3, 0.3, 0], clampOpt);
  return (
    <>
      <Device x={500} y={310} w={840} h={500} at={0}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 14, textAlign: "center", ...monoStyle(17, LIME) }}>recovery phrase · write it down</div>
        <div style={{ position: "absolute", left: 18, top: 70, right: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 14, columnGap: 10 }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const shown = frame >= words + i;
            const hit = frame >= read + Math.round(i * 0.8);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, ...monoStyle(17, hit ? PINK : GREY), opacity: shown ? 1 : 0 }}>
                {String(i + 1).padStart(2, "0")}
                <Bar w={96} color={hit ? PINK : PAPER} />
              </div>
            );
          })}
        </div>
      </Device>
      <svg style={{ position: "absolute", left: 0, top: 0, width: 1000, height: 1080, overflow: "visible" }}>
        <polygon points="300,720 120,530 880,530" fill={PINK} opacity={beam} />
      </svg>
      <Appear at={b.at("chip")} from="up" style={{ position: "absolute", left: 215, top: 705 }}>
        <Chip size={170} color={PINK}>
          <Icon name="eye" size={100} />
        </Chip>
      </Appear>
      <Tag x={300} y={940} at={b.at("chip") + 4} color={PAPER} size={20}>hidden chip</Tag>
      <Tag x={300} y={640} at={read} color={PINK} size={20}>reads the screen</Tag>
      <InkPath d="M 720 1000 L 820 660 L 920 1000 M 750 900 L 890 900 M 780 790 L 860 790 M 820 660 L 820 620" at={sent} dur={18} width={7} color={PAPER} />
      <Icon name="globe" x={820} y={600} at={sent + 10} size={70} color={LIME} />
      {[0, 1, 2].map((i) => (
        <InkPath key={i} d={`M ${430 + i * 40} ${730 - i * 40} Q ${470 + i * 50} ${790} ${430 + i * 40} ${850 + i * 40}`} at={sent + i * 5} dur={10} width={7} color={LIME} />
      ))}
      <Arrow from={[580, 760]} to={[770, 640]} at={b.at("out")} dur={16} bend={-30} color={LIME} dashed />
      <Tag x={820} y={1030} at={b.at("mobile")} color={LIME} size={22}>LTE · eSIM</Tag>
    </>
  );
};

const Losses: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const losses = b.at("losses");
  const cols = 25;
  return (
    <Board label="onchain researchers' estimate" tag="Losses">
      <Tag x={140} y={60} at={b.at("up")} color={PINK} size={22}>up to</Tag>
      <Counter x={500} y={150} at={b.at("ninety")} value="$93.2M" size={150} label="estimated losses" />
      <div style={{ position: "absolute", left: 63, top: 290 }}>
        {Array.from({ length: 300 }).map((_, i) => {
          const show = Math.round(random(`in-${i}`) * 20);
          const drain = losses + Math.round(random(`out-${i}`) * 110);
          if (frame < show) return null;
          const empty = frame >= drain;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i % cols) * 35,
                top: Math.floor(i / cols) * 35,
                width: 28,
                height: 28,
                background: empty ? PAPER_2 : LIME,
                border: `3px solid ${empty ? GREY : INK}`,
                boxSizing: "border-box",
              }}
            />
          );
        })}
      </div>
      <Tag x={500} y={500} at={b.at("three")} color={PAPER} size={28} rot={-3}>300+ wallets</Tag>
      {[250, 500, 750].map((x, i) => (
        <Arrow key={x} from={[x, 730]} to={[500 + (x - 500) * 0.2, 840]} at={losses + i * 4} dur={14} color={PINK} />
      ))}
      <Icon name="wallet" x={500} y={910} at={losses + 10} size={120} box={PINK} />
      <Note x={810} y={900} at={b.at("estimate")} text="Ledger hasn't confirmed a total" w={280} size={28} rot={4} />
    </Board>
  );
};

const Frozen: React.FC = () => {
  const b = useBeat();
  const froze = b.at("froze");
  const ledger = b.at("ledger");
  const nodes: { icon: "shield" | "building" | "person"; label: string }[] = [
    { icon: "shield", label: "Ledger" },
    { icon: "building", label: "reseller" },
    { icon: "person", label: "buyer" },
  ];
  return (
    <>
      <Tag x={230} y={70} at={0} color={LIME} size={22}>Tether</Tag>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ position: "absolute", left: 170, top: 380 - i * 48 }}>
          <Appear at={2 + i * 3} from="drop">
            <Coin symbol="₮" size={130} color={LIME} />
          </Appear>
        </div>
      ))}
      <Appear at={froze} from="fade" style={{ position: "absolute", left: 130, top: 120, width: 220, height: 420, background: "rgba(92,225,255,0.35)", border: `5px solid ${CYAN}` }}>
        {null}
      </Appear>
      <Stamp x={240} y={330} at={froze} text="Frozen" size={60} color={INK} rot={-10} />
      <Counter x={680} y={260} at={b.at("ten")} value="$10M" size={170} color={PAPER} label="in USDT" />
      <Board x={40} y={570} w={920} h={460} at={ledger} label="what Ledger says" tag="Per Ledger" shadow={CYAN}>
        {nodes.map((n, i) => (
          <React.Fragment key={n.label}>
            <Icon name={n.icon} x={140 + i * 320} y={140} at={ledger + 4 + i * 4} size={120} box={i === 0 ? CYAN : PAPER} />
            <Tag x={140 + i * 320} y={235} at={ledger + 6 + i * 4} color={PAPER} size={18}>{n.label}</Tag>
          </React.Fragment>
        ))}
        <Arrow from={[215, 140]} to={[385, 140]} at={b.at("calls")} dur={12} />
        <Arrow from={[535, 140]} to={[705, 140]} at={b.at("calls") + 4} dur={12} />
        <Icon name="cross" x={620} y={140} at={b.at("physical")} size={80} color={PINK} />
        <Tag x={640} y={36} at={b.at("physical") + 3} color={PINK} size={18} rot={0}>physical tampering</Tag>
        <Stamp x={460} y={325} at={b.at("software")} text="Software: not breached" size={46} color={PINK} rot={-4} />
      </Board>
    </>
  );
};

const Outro: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Appear at={0} from="drop" style={{ position: "absolute", left: 300, top: 320, width: 400, height: 300 }}>
        <div style={{ position: "absolute", inset: 0, background: PAPER_2, border: `6px solid ${INK}`, boxShadow: `12px 12px 0 ${LIME}` }} />
        <div style={{ position: "absolute", left: 170, top: 0, width: 60, bottom: 0, background: PINK, borderLeft: `5px solid ${INK}`, borderRight: `5px solid ${INK}` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 210, textAlign: "center" }}>
          <span style={{ ...monoStyle(18, INK), background: PAPER, border: `3px solid ${INK}`, padding: "4px 10px" }}>sealed</span>
        </div>
      </Appear>
      <Icon name="check" x={700} y={330} at={b.at("source")} size={120} box={LIME} />
      <Tag x={500} y={700} at={b.at("source")} color={LIME} size={26}>official store</Tag>
      <Appear at={b.at("follow")} from="scale" style={{ position: "absolute", left: 175, top: 810 }}>
        <Chip size={130} color={PINK}>
          <Icon name="question" size={80} />
        </Chip>
      </Appear>
      <Stamp x={620} y={875} at={b.at("next")} text="Next case?" size={64} color={PINK} rot={-6} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1">
      <Hook />
    </Beat>
    <Beat id="b2">
      <Reseller />
    </Beat>
    <Beat id="b3">
      <Teardown />
    </Beat>
    <Beat id="b4">
      <Exfil />
    </Beat>
    <Beat id="b5">
      <Losses />
    </Beat>
    <Beat id="b6">
      <Frozen />
    </Beat>
    {/* b7 = moment produit : dessiné par l'habillage (TaleVideo), rien ici. */}
    <Beat id="b8">
      <Outro />
    </Beat>
  </>
);
