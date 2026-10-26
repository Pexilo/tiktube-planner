// Story « Bitcoin Pizza Day » : 10 000 BTC pour deux pizzas, le 22 mai 2010.
// Une scène par beat, chaque apparition calée sur un mot de la voix off via useBeat().at("mot").
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  Actor,
  Appear,
  Arrow,
  At,
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
  ORANGE,
  PAPER,
  PAPER_2,
  PINK,
  PriceChart,
  Redacted,
  Stamp,
  Tag,
  Title,
  Transfer,
  useBeat,
  useTale,
} from "../legacy";
import type { StoryProps } from "../types";

const heading = (size: number, color: string = INK): React.CSSProperties => ({
  fontFamily: "var(--heading)",
  fontWeight: 800,
  fontSize: size,
  letterSpacing: "-0.04em",
  lineHeight: 0.95,
  color,
  whiteSpace: "nowrap",
});

/** Boîte à pizza vue de dessus (couvercle carré, part de pizza au centre). */
const PizzaBox: React.FC<{ size?: number; color?: string; shadow?: string }> = ({ size = 340, color = PAPER_2, shadow = INK }) => (
  <div style={{ position: "relative", width: size, height: size, background: color, border: `7px solid ${INK}`, boxShadow: `14px 14px 0 ${shadow}` }}>
    <div style={{ position: "absolute", inset: size * 0.07, border: `4px dashed ${INK}`, opacity: 0.5 }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: size * 0.1, textAlign: "center", ...heading(size * 0.15) }}>PIZZA</div>
    <div style={{ position: "absolute", left: "50%", top: "62%", transform: "translate(-50%, -50%)" }}>
      <Icon name="pizza" at={0} size={size * 0.48} fill={ORANGE} />
    </div>
  </div>
);

const Hook: React.FC = () => {
  const { tale } = useTale();
  const b = useBeat();
  const frame = useCurrentFrame();
  const strike = interpolate(frame, [b.at("order"), b.at("order") + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Title x={500} y={140} at={0} text={tale.hook} size={112} />
      <Appear at={2} from="drop">
        <At x={300} y={660} rot={-4}>
          <PizzaBox size={360} shadow={LIME} />
        </At>
      </Appear>
      {/* Ficelle de l'étiquette de prix */}
      <InkPath d="M 470 520 C 540 500 570 520 610 540" at={b.at("expensive") - 6} dur={8} width={5} color={PAPER} />
      <Appear at={b.at("expensive")} from="scale">
        <At x={770} y={640} rot={4}>
          <div style={{ width: 340, background: PAPER, border: `6px solid ${INK}`, boxShadow: `10px 10px 0 ${PINK}`, padding: "18px 22px 22px", boxSizing: "border-box" }}>
            <div style={monoStyle(18, GREY)}>price tag</div>
            <div style={{ position: "relative", display: "inline-block", marginTop: 6 }}>
              <div style={heading(120)}>$41</div>
              <div style={{ position: "absolute", left: -6, top: "52%", height: 12, width: `${strike * 110}%`, background: PINK, transform: "rotate(-8deg)" }} />
            </div>
            <Appear at={b.at("order") + 4} from="up">
              <div style={{ marginTop: 12, display: "inline-block", background: PINK, border: `4px solid ${INK}`, padding: "6px 10px", ...heading(44) }}>$???,???,???</div>
              <div style={{ ...monoStyle(16, INK), marginTop: 6 }}>and climbing ↑</div>
            </Appear>
          </div>
        </At>
      </Appear>
      <Stamp x={300} y={900} at={b.at("history")} text="10,000 BTC" size={70} color={PINK} rot={-8} />
    </>
  );
};

const Offer: React.FC = () => {
  const b = useBeat();
  return (
    <Board label="BitcoinTalk forum · May 2010" tag="Case file">
      <Actor x={180} y={250} at={b.at("programmer")} kind="dev" label="Laszlo H. · programmer" color={CYAN} />
      <Tag x={180} y={440} at={b.at("Laszlo") + 4} color={LIME} size={18}>Jacksonville, FL</Tag>
      {/* Carte du post de forum */}
      <Appear at={b.at("posts")} from="right">
        <div style={{ position: "absolute", left: 380, top: 70, width: 570, background: PAPER, border: `5px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}` }}>
          <div style={{ background: INK, padding: "10px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ ...monoStyle(15, INK), background: PINK, padding: "3px 8px" }}>topic</span>
            <span style={monoStyle(15, PAPER)}>new post</span>
          </div>
          <div style={{ padding: "18px 22px 26px" }}>
            <div style={{ ...heading(56), whiteSpace: "normal" }}>Pizza for bitcoins?</div>
            <div style={{ position: "relative", height: 150, marginTop: 18 }}>
              <Redacted x={0} y={0} w={520} at={b.at("forum")} lines={3} color={GREY} />
            </div>
          </div>
        </div>
      </Appear>
      {/* L'offre : 2 pizzas contre 10 000 BTC */}
      <Icon name="pizza" x={150} y={730} at={b.at("two")} size={150} box={ORANGE} rot={-6} />
      <Icon name="pizza" x={340} y={730} at={b.at("two") + 5} size={150} box={ORANGE} rot={5} />
      <Tag x={245} y={860} at={b.at("large")} color={PAPER} size={20}>2 large pizzas</Tag>
      <Arrow from={[450, 730]} to={[590, 730]} at={b.at("ten") - 8} dur={10} label="for" />
      <At x={720} y={720}>
        <Appear at={b.at("ten")} from="scale">
          <Coin size={140} />
        </Appear>
      </At>
      <Counter x={720} y={870} at={b.at("ten") + 4} value="10,000 BTC" size={76} dur={24} />
    </Board>
  );
};

const NoPrice: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Board x={50} y={30} w={900} h={560} label="BTC price · 2010" tag="Chart" shadow={LIME} ruled={false}>
        {/* Axes + grille : la courbe reste collée au zéro */}
        <div style={{ position: "absolute", left: 90, top: 40, width: 740, height: 380, borderLeft: `5px solid ${INK}`, borderBottom: `5px solid ${INK}`, backgroundImage: "repeating-linear-gradient(0deg, transparent 0 93px, rgba(11,11,14,0.14) 93px 95px)" }} />
        <div style={{ position: "absolute", left: 30, top: 40, ...monoStyle(16, GREY) }}>$</div>
        <PriceChart x={95} y={392} w={735} h={22} at={b.at("bitcoin") - 4} dur={30} points={[0.2, 0.5, 0.3, 0.6, 0.4, 0.7, 0.5, 0.8, 0.6]} color={PINK} grid={false} />
        <Callout x={460} y={220} to={[460, 404]} at={b.at("price")} text="almost $0" color={LIME} />
        <Tag x={130} y={460} at={b.at("then")} color={PAPER} size={18}>2010</Tag>
      </Board>
      {/* L'équation */}
      <At x={150} y={740}>
        <Appear at={b.at("ten")} from="scale">
          <Coin size={130} />
        </Appear>
      </At>
      <Counter x={560} y={740} at={b.at("ten")} value="10,000 BTC" size={104} color={PAPER} dur={24} />
      <Tag x={500} y={835} at={b.at("worth")} color={PINK} size={22}>= worth about</Tag>
      <Counter x={500} y={965} at={b.at("forty")} value="$41" size={150} color={LIME} dur={20} />
    </>
  );
};

const CoastToCoast: React.FC = () => {
  const b = useBeat();
  const frame = useCurrentFrame();
  const t = b.at("delivered");
  const truckX = interpolate(frame, [t, t + 28], [660, 820], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Board tone="ink" label="22 May 2010 · coast to coast" tag="The deal" shadow={CYAN}>
      <InkPath d="M 500 30 L 500 990" at={0} dur={16} width={4} color={GREY} dashed />
      <Tag x={250} y={50} at={b.at("California") - 2} color={CYAN} size={18}>California</Tag>
      <Tag x={750} y={50} at={0} color={ORANGE} size={18}>Florida</Tag>
      <Actor x={210} y={260} at={b.at("teenager")} kind="person" label="Jeremy S. · 19" color={LIME} />
      <Actor x={820} y={260} at={0} kind="dev" label="Laszlo H." color={CYAN} flip />
      <Stamp x={500} y={250} at={b.at("deal")} text="Deal" size={64} color={LIME} rot={-8} />
      {/* Commande par téléphone → pizzeria en Floride → livraison */}
      <Icon name="phone" x={210} y={590} at={b.at("orders")} size={130} box={CYAN} rot={-6} />
      <Arrow from={[290, 590]} to={[515, 590]} at={b.at("orders") + 4} dur={14} color={PAPER} bend={-40} label="phone order" labelColor={CYAN} />
      <Icon name="pizza" x={590} y={590} at={b.at("pizzas")} size={130} box={ORANGE} rot={4} />
      <Tag x={590} y={700} at={b.at("pizzas") + 4} color={PAPER} size={16}>Papa John's</Tag>
      <InkPath d="M 590 520 L 590 470 L 900 470" at={t - 6} dur={12} width={4} color={GREY} dashed />
      {frame >= t ? (
        <At x={truckX} y={470}>
          <Icon name="truck" at={t} size={104} box={LIME} />
        </At>
      ) : null}
      {/* Paiement dans l'autre sens */}
      <Transfer from={[820, 870]} to={[210, 870]} at={b.at("across")} dur={30} bend={-50} amount="10,000 BTC" size={84} />
      <Tag x={515} y={960} at={b.at("across") + 8} color={ORANGE} size={18}>← paid in bitcoin</Tag>
    </Board>
  );
};

const Fortune: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Board x={50} y={30} w={900} h={520} label="BTC price · 2010 → today" tag="Chart" shadow={PINK} ruled={false}>
        <PriceChart
          x={90}
          y={70}
          w={740}
          h={340}
          at={b.at("today")}
          dur={34}
          points={[1, 1, 1.4, 2, 5, 3, 9, 20, 14, 35, 60, 40, 80, 130, 100, 180]}
          color={PINK}
          labels={[{ i: 0, text: "$41", color: LIME }]}
          end="today"
        />
      </Board>
      <Icon name="pizza" x={330} y={680} at={b.at("pizzas")} size={140} box={ORANGE} rot={-6} />
      <Icon name="pizza" x={520} y={680} at={b.at("pizzas") + 5} size={140} box={ORANGE} rot={6} />
      <Appear at={b.at("worth")} from="scale">
        <At x={670} y={680}>
          <div style={heading(120, PINK)}>=</div>
        </At>
      </Appear>
      <Title x={500} y={880} at={b.at("hundreds")} text="*Hundreds* of *millions*" size={100} stagger={4} />
      <Tag x={500} y={1030} at={b.at("dollars")} color={LIME} size={20}>at today's prices</Tag>
    </>
  );
};

const PizzaDay: React.FC = () => {
  const b = useBeat();
  const party: { x: number; y: number; c: string; r: number }[] = [
    { x: 150, y: 260, c: LIME, r: -10 },
    { x: 850, y: 260, c: CYAN, r: 8 },
    { x: 150, y: 600, c: PINK, r: 6 },
    { x: 850, y: 600, c: ORANGE, r: -8 },
  ];
  return (
    <>
      <Appear at={b.at("May")} from="drop">
        <div style={{ position: "absolute", left: 280, top: 160, width: 440, background: PAPER, border: `6px solid ${INK}`, boxShadow: `14px 14px 0 ${PINK}` }}>
          <div style={{ background: PINK, borderBottom: `6px solid ${INK}`, padding: "14px 0", textAlign: "center", ...heading(84) }}>MAY</div>
          <div style={{ height: 290, display: "grid", placeItems: "center" }}>
            <Appear at={b.at("twenty")} from="scale">
              <div style={heading(250)}>22</div>
            </Appear>
          </div>
        </div>
      </Appear>
      <Tag x={610} y={160} at={b.at("every")} color={LIME} size={20} rot={8}>every year</Tag>
      {party.map((p, i) => (
        <Icon key={i} name="pizza" x={p.x} y={p.y} at={b.at("celebrates") + i * 4} size={130} box={p.c} rot={p.r} />
      ))}
      <Title x={500} y={890} at={b.at("Bitcoin")} text="Bitcoin *Pizza* Day" size={110} stagger={4} />
    </>
  );
};

const Outro: React.FC = () => {
  const b = useBeat();
  return (
    <>
      <Board x={110} y={160} w={780} h={600} tone="ink" label="22 May 2010" tag="Case file" shadow={LIME}>
        <Icon name="pizza" x={390} y={230} at={4} size={240} color={PAPER} fill={ORANGE} />
        <Tag x={390} y={440} at={8} color={PAPER} size={20}>2 pizzas · 10,000 BTC</Tag>
      </Board>
      <Stamp x={500} y={820} at={b.at("remember")} text="Case closed" size={80} color={PINK} rot={-6} />
    </>
  );
};

export const Story: React.FC<StoryProps> = () => (
  <>
    <Beat id="b1">
      <Hook />
    </Beat>
    <Beat id="b2">
      <Offer />
    </Beat>
    <Beat id="b3">
      <NoPrice />
    </Beat>
    <Beat id="b4" tail={6}>
      <CoastToCoast />
    </Beat>
    {/* b5 = moment produit : dessiné par l'habillage (TaleVideo), rien ici. */}
    <Beat id="b6">
      <Fortune />
    </Beat>
    <Beat id="b7">
      <PizzaDay />
    </Beat>
    {/* Dernier plan : il boucle sur le premier (« …remember: » → « This is the most expensive pizza order in history. »). */}
    <Beat id="b8" loop>
      <Outro />
    </Beat>
  </>
);
