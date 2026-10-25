import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, MONO, useTheme } from "../lib/theme";
import type { L, Widget } from "../lib/types";
import { clamp, EASE_IN_OUT, EASE_OUT, Sfx } from "./fx";

/*
 * Widgets "registre" : les composants du site de l'app recréés en motion design natif
 * (papier crème, encre noire, ombres franches, tampons, barres hachurées), animés et pilotés par le JSON.
 * Tous sont dessinés sur une base de 920 px de large ; `w` fixe la largeur réelle.
 */

const INK = "#0B0B0E";
const PAPER = "#EFEADF";
const PAPER_2 = "#E4DECE";
const UP = "#4E7A00"; // vert lisible sur papier
const ORANGE = "#FF9D2E";

type Ctx = { k: number; t: (l: L | undefined) => string; pink: string; lime: string; cyan: string };
const useCtx = (w: number): Ctx => {
  const { t, b } = useTheme();
  return { k: w / 920, t, pink: b.primary, lime: b.secondary, cyan: b.accent };
};

const tone = (c: Ctx, name?: string) =>
  name === "pink" ? c.pink : name === "lime" ? c.lime : name === "cyan" ? c.cyan : name === "orange" ? ORANGE : name === "up" ? UP : name === "down" ? c.pink : INK;

const mono = (k: number, size = 17, color: string = INK): React.CSSProperties => ({
  fontFamily: MONO,
  fontWeight: 700,
  fontSize: size * 1.4 * k,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color,
  whiteSpace: "nowrap",
});

const useEnter = (start: number, cfg: Partial<{ damping: number; stiffness: number; mass: number }> = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 170, mass: 0.8, ...cfg } });
};

/** Nombre qui défile jusqu'à sa valeur ; préfixe/suffixe conservés ("−$1,743.20", "+5,191", "13 / 46 TX"). */
export const Count: React.FC<{ value: string; start: number; dur?: number; style?: React.CSSProperties }> = ({ value, start, dur = 32, style }) => {
  const frame = useCurrentFrame();
  const m = value.match(/^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return <span style={style}>{value}</span>;
  const [, pre, num, suf] = m;
  const target = parseFloat(num.replace(/,/g, ""));
  const dec = num.includes(".") ? num.split(".")[1].length : 0;
  const p = interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE_OUT });
  const n = (target * p).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: num.includes(",") });
  return <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", ...style }}>{pre}{n}{suf}</span>;
};

/** Tampon qui claque (grossit puis s'écrase, légère rotation). Garde sa place dans la mise en page avant d'apparaître. */
const Stamp: React.FC<{ at: number; rot?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, rot = -3, children, style }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 11, stiffness: 320, mass: 0.6 });
  return (
    <div style={{ display: "inline-block", opacity: frame < at ? 0 : Math.min(1, (frame - at) / 2), transform: `scale(${2.2 - 1.2 * p}) rotate(${rot * p}deg)`, transformOrigin: "center", ...style }}>
      {children}
    </div>
  );
};

/** Feuille du registre : tombe sur la table puis respire doucement. En-tête "FORM WD-xx" ou "SCHEDULE x". */
const Sheet: React.FC<{ c: Ctx; start?: number; form?: string; title?: string; dark?: boolean; shadow?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  c,
  start = 0,
  form,
  title,
  dark,
  shadow,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = useEnter(start, { damping: 14, stiffness: 150 });
  const drift = Math.sin(frame / 45) * 0.5;
  const { k } = c;
  return (
    <div
      style={{
        position: "relative",
        width: 920 * k,
        boxSizing: "border-box",
        background: dark ? INK : PAPER,
        border: `${4 * k}px solid ${INK}`,
        boxShadow: `${14 * k}px ${14 * k}px 0 ${shadow ?? c.pink}`,
        transform: `translateY(${(1 - p) * 160 * k}px) rotate(${(1 - p) * -7 + drift}deg) scale(${0.88 + 0.12 * p})`,
        opacity: Math.min(1, p * 2.5),
        color: dark ? PAPER : INK,
        fontFamily: font("Space Grotesk"),
        ...style,
      }}
    >
      {form || title ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16 * k, background: INK, padding: `${12 * k}px ${18 * k}px`, borderBottom: `${4 * k}px solid ${INK}` }}>
          {form ? <span style={{ ...mono(k, 16), background: form.startsWith("SCHEDULE") ? c.lime : c.pink, padding: `${5 * k}px ${10 * k}px` }}>{form}</span> : null}
          {title ? <span style={{ ...mono(k, 16, PAPER), overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span> : null}
        </div>
      ) : null}
      <div style={{ padding: `${26 * k}px ${30 * k}px ${30 * k}px` }}>{children}</div>
    </div>
  );
};

const Big: React.FC<{ k: number; size: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ k, size, color = INK, children, style }) => (
  <div style={{ fontFamily: font("Bricolage Grotesque"), fontWeight: 800, fontSize: size * k, letterSpacing: "-0.04em", lineHeight: 1, color, ...style }}>{children}</div>
);

/** Ligne qui apparaît en glissant depuis la gauche. */
const Row: React.FC<{ at: number; k: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, k, children, style }) => {
  const p = useEnter(at, { damping: 18, stiffness: 190 });
  return <div style={{ transform: `translateX(${(1 - p) * -90 * k}px)`, opacity: Math.min(1, p * 2), ...style }}>{children}</div>;
};

/** Barre qui se remplit (pleine ou hachurée, comme les "timelines" du site). */
const Bar: React.FC<{ k: number; at: number; to: number; color: string; hatched?: boolean; h?: number; dur?: number }> = ({ k, at, to, color, hatched, h = 16, dur = 26 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ height: h * k, background: PAPER_2, border: `${2 * k}px solid ${INK}`, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(1, to)) * p * 100}%`,
          background: hatched ? `repeating-linear-gradient(-45deg, ${color} 0 ${4 * k}px, transparent ${4 * k}px ${9 * k}px)` : color,
          borderRight: p > 0.02 ? `${2 * k}px solid ${INK}` : undefined,
        }}
      />
    </div>
  );
};

/** Curseur pixel du site (flèche). */
const Cursor: React.FC<{ k: number; x: number; y: number; down?: boolean }> = ({ k, x, y, down }) => (
  <svg viewBox="0 0 16 16" width={46 * k} height={46 * k} style={{ position: "absolute", left: x, top: y, transform: `scale(${down ? 0.86 : 1})`, transformOrigin: "top left", shapeRendering: "crispEdges", filter: `drop-shadow(${3 * k}px ${3 * k}px 0 rgba(11,11,14,.45))` }}>
    <path d="M1 1 H2 V2 H3 V3 H4 V4 H5 V5 H6 V6 H7 V7 H8 V8 H9 V9 H10 V10 H6 V11 H7 V12 H8 V14 H6 V12 H5 V11 H4 V12 H3 V13 H1 Z" fill={INK} />
    <path d="M2 3 H3 V4 H4 V5 H5 V6 H6 V7 H7 V8 H8 V9 H5 V10 H4 V11 H3 V12 H2 Z" fill={PAPER} />
  </svg>
);

/* ------------------------------------------------------------------ Widgets */

const PnlWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "pnl" }> }> = ({ c, d }) => {
  const { k, t } = c;
  return (
    <Sheet c={c} form={d.form} title={d.ledger}>
      <Big k={k} size={128}>
        <Count value={d.value} start={8} dur={40} />
      </Big>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * k, marginTop: 18 * k }}>
        <Stamp at={46}>
          <span style={{ display: "inline-block", fontFamily: font("Bricolage Grotesque"), fontWeight: 800, fontSize: 38 * k, background: c.pink, color: INK, border: `${3 * k}px solid ${INK}`, padding: `${6 * k}px ${16 * k}px`, boxShadow: `${6 * k}px ${6 * k}px 0 ${INK}` }}>{d.change}</span>
        </Stamp>
        {d.note ? <span style={mono(k, 17, "#6b675d")}>{t(d.note)}</span> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 26 * k, borderTop: `${3 * k}px solid ${INK}` }}>
        {d.cells.map((cell, i) => (
          <Row key={i} at={60 + i * 7} k={k} style={{ padding: `${16 * k}px ${12 * k}px ${10 * k}px`, borderRight: i % 2 === 0 ? `${2 * k}px dashed #9a958a` : undefined, borderBottom: i < 2 ? `${2 * k}px dashed #9a958a` : undefined }}>
            <div style={mono(k, 16, cell.tone === "down" ? c.pink : "#6b675d")}>{String(i + 2).padStart(2, "0")} {t(cell.label)}</div>
            <Big k={k} size={54} color={tone(c, cell.tone)} style={{ marginTop: 6 * k }}>
              <Count value={cell.value} start={64 + i * 7} dur={28} />
            </Big>
          </Row>
        ))}
      </div>
      <Sfx name="swipe" at={0} volume={0.5} />
      <Sfx name="pop" at={46} volume={0.55} />
      {d.cells.map((_, i) => <Sfx key={i} name="click" at={62 + i * 7} volume={0.3} />)}
    </Sheet>
  );
};

const AddressWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "address" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const frame = useCurrentFrame();
  const typed = Math.floor(interpolate(frame, [20, 20 + d.address.length * 1.6], [0, d.address.length], clamp));
  const chain = Math.min(d.chains.length - 1, Math.floor(interpolate(frame, [52, 92], [0, d.chains.length], clamp)));
  // Le curseur vient cliquer le bouton.
  const CLICK = 112;
  const mv = interpolate(frame, [92, CLICK - 4], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const down = frame >= CLICK - 2 && frame < CLICK + 6;
  const pressed = frame >= CLICK - 2 && frame < CLICK + 8;
  return (
    <div style={{ position: "relative" }}>
      <Sheet c={c} form={d.form} title={d.ledger}>
        <Big k={k} size={76}>{t(d.title)}</Big>
        <div style={{ fontFamily: font("Space Grotesk"), fontWeight: 700, fontSize: 36 * k, marginTop: 6 * k }}>{t(d.sub)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 * k, marginTop: 26 * k }}>
          <span style={mono(k, 15, c.pink)}>01 · {d.inputLabel ? t(d.inputLabel) : "ADDRESS / ENS"}</span>
        </div>
        <div style={{ marginTop: 10 * k, border: `${4 * k}px solid ${INK}`, background: "#fff", boxShadow: `${8 * k}px ${8 * k}px 0 ${c.pink}`, padding: `${16 * k}px ${20 * k}px`, ...mono(k, 34), letterSpacing: "0.02em", textTransform: "none" }}>
          {d.address.slice(0, typed)}
          <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0 }}>▍</span>
        </div>
        <div style={{ display: "flex", gap: 12 * k, marginTop: 22 * k, flexWrap: "wrap" }}>
          {d.chains.map((ch, i) => (
            <span key={ch} style={{ ...mono(k, 17, i === chain && frame >= 52 ? PAPER : INK), background: i === chain && frame >= 52 ? INK : "transparent", border: `${3 * k}px solid ${INK}`, padding: `${8 * k}px ${14 * k}px` }}>{ch}</span>
          ))}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14 * k,
            marginTop: 26 * k,
            background: c.lime,
            border: `${4 * k}px solid ${INK}`,
            padding: `${16 * k}px ${26 * k}px`,
            fontFamily: font("Bricolage Grotesque"),
            fontWeight: 800,
            fontSize: 34 * k,
            textTransform: "uppercase",
            boxShadow: pressed ? "none" : `${8 * k}px ${8 * k}px 0 ${INK}`,
            transform: pressed ? `translate(${8 * k}px, ${8 * k}px)` : undefined,
          }}
        >
          {t(d.button)} →
        </div>
        {d.tape ? (
          <div style={{ marginTop: 26 * k }}>
            <Stamp at={CLICK + 14} rot={-2}>
              <span style={{ ...mono(k, 18, PAPER), display: "inline-block", background: c.pink, color: INK, border: `${3 * k}px solid ${INK}`, padding: `${8 * k}px ${14 * k}px` }}>{t(d.tape)}</span>
            </Stamp>
          </div>
        ) : null}
      </Sheet>
      <Cursor k={k} x={interpolate(mv, [0, 1], [880, 300]) * k} y={interpolate(mv, [0, 1], [820, 500]) * k} down={down} />
      <Sfx name="swipe" at={0} volume={0.5} />
      {Array.from({ length: Math.ceil(d.address.length / 3) }).map((_, i) => <Sfx key={i} name="click" at={20 + i * 5} volume={0.22} />)}
      <Sfx name="click" at={CLICK - 2} volume={0.7} />
      {d.tape ? <Sfx name="pop" at={CLICK + 14} volume={0.55} /> : null}
    </div>
  );
};

const GradeWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "grade" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const frame = useCurrentFrame();
  // La note "roule" (A → F) avant de se figer.
  const LAND = 44;
  const rolls = ["A+", "B", "F", "A", "D", "B+", "C", "E", "A−", "D+"];
  const letter = frame < LAND ? rolls[Math.floor(frame / 3) % rolls.length] : d.grade;
  const land = useEnter(LAND, { damping: 9, stiffness: 260, mass: 0.6 });
  return (
    <Sheet c={c} form={d.form} title={d.ledger} dark shadow={c.cyan}>
      <div style={{ display: "flex", gap: 26 * k, alignItems: "stretch" }}>
        <div style={{ width: 210 * k, border: `${4 * k}px solid ${c.cyan}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `${12 * k}px 0` }}>
          <div style={mono(k, 15, c.cyan)}>{d.gradeLabel ? t(d.gradeLabel) : "GRADE"}</div>
          <Big k={k} size={130} color={PAPER} style={{ transform: `scale(${frame < LAND ? 1 : 1.5 - 0.5 * land})`, marginTop: 6 * k }}>{letter}</Big>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 * k }}>
          <div style={{ ...mono(k, 30, PAPER), letterSpacing: "0.02em", textTransform: "none" }}>{d.wallet}</div>
          {d.stats.map((s, i) => (
            <Row key={i} at={50 + i * 6} k={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `${2 * k}px dashed rgba(239,234,223,.25)`, paddingTop: 8 * k }}>
              <span style={mono(k, 15, "#9a958a")}>{t(s.label)}</span>
              <Big k={k} size={38} color={tone(c, s.tone) === INK ? PAPER : tone(c, s.tone)}><Count value={s.value} start={52 + i * 6} dur={24} /></Big>
            </Row>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 26 * k, display: "flex", flexDirection: "column", gap: 16 * k }}>
        {d.scores.map((s, i) => (
          <Row key={i} at={70 + i * 9} k={k}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 * k }}>
              <span style={mono(k, 16, PAPER)}>{t(s.label)}</span>
              <span style={mono(k, 16, tone(c, s.color))}><Count value={String(s.value)} start={72 + i * 9} dur={26} /></span>
            </div>
            <div style={{ height: 14 * k, background: "rgba(239,234,223,.12)" }}>
              <div style={{ height: "100%", width: `${s.value * interpolate(frame, [72 + i * 9, 98 + i * 9], [0, 1], { ...clamp, easing: EASE_OUT })}%`, background: tone(c, s.color) }} />
            </div>
          </Row>
        ))}
      </div>
      <Sfx name="swipe" at={0} volume={0.5} />
      <Sfx name="ding" at={LAND} volume={0.6} />
      {d.scores.map((_, i) => <Sfx key={i} name="pop" at={72 + i * 9} volume={0.25} />)}
    </Sheet>
  );
};

const WhatIfWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "whatif" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const best = d.rows.findIndex((r) => r.best);
  const BEST_AT = 40 + d.rows.length * 12 + 14;
  return (
    <Sheet c={c} form={d.form} title={t(d.title)}>
      <div style={{ display: "flex", gap: 22 * k, marginBottom: 14 * k }}>
        <span style={mono(k, 15)}>■ {t(d.you)}</span>
        <span style={mono(k, 15)}>▨ {t(d.other)}</span>
      </div>
      {d.rows.map((r, i) => {
        const at = 36 + i * 12;
        return (
          <Row key={i} at={at} k={k} style={{ padding: `${12 * k}px ${14 * k}px`, borderTop: `${2 * k}px dashed #9a958a`, background: i === best ? "#fff" : undefined, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 * k }}>
              <span style={mono(k, 18, c.pink)}>{String.fromCharCode(65 + i)}</span>
              <span style={{ fontWeight: 700, fontSize: 36 * k, flex: 1 }}>{t(r.label)}</span>
              <Big k={k} size={40} color={r.delta.startsWith("-") || r.delta.startsWith("−") ? c.pink : UP}>
                <Count value={r.delta} start={at + 6} dur={26} />
              </Big>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 * k, marginTop: 8 * k, paddingLeft: 34 * k }}>
              <Bar k={k} at={at + 4} to={r.you} color={INK} h={12} />
              <Bar k={k} at={at + 8} to={r.other} color={INK} hatched h={12} />
            </div>
            {i === best ? (
              <div style={{ position: "absolute", right: 200 * k, top: -20 * k }}>
                <Stamp at={BEST_AT} rot={4}>
                  <span style={{ ...mono(k, 17), display: "inline-block", background: c.pink, border: `${3 * k}px solid ${INK}`, padding: `${6 * k}px ${12 * k}px` }}>{t(d.bestLabel)}</span>
                </Stamp>
              </div>
            ) : null}
          </Row>
        );
      })}
      <Sfx name="swipe" at={0} volume={0.5} />
      {d.rows.map((_, i) => <Sfx key={i} name="click" at={36 + i * 12} volume={0.3} />)}
      <Sfx name="pop" at={BEST_AT} volume={0.6} />
    </Sheet>
  );
};

const RegretsWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "regrets" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const frame = useCurrentFrame();
  const line = interpolate(frame, [20, 30 + d.rows.length * 14], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <Sheet c={c} form={d.form} title={t(d.title)}>
      <div style={{ position: "relative", paddingLeft: 46 * k }}>
        <div style={{ position: "absolute", left: 13 * k, top: 10 * k, width: 4 * k, height: `calc(${line * 100}% - ${20 * k}px)`, background: INK }} />
        {d.rows.map((r, i) => {
          const at = 24 + i * 14;
          const good = !(r.value.startsWith("-") || r.value.startsWith("−"));
          return (
            <Row key={i} at={at} k={k} style={{ position: "relative", marginBottom: 12 * k }}>
              <div style={{ position: "absolute", left: -44 * k, top: 18 * k, width: 26 * k, height: 26 * k, border: `${4 * k}px solid ${INK}`, background: good ? c.lime : PAPER, boxSizing: "border-box" }} />
              <div style={{ border: `${3 * k}px solid ${good && i === d.rows.length - 1 ? INK : "#bdb7aa"}`, background: good && i === d.rows.length - 1 ? "#fff" : "rgba(255,255,255,.35)", padding: `${10 * k}px ${16 * k}px ${12 * k}px` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={mono(k, 15, "#6b675d")}>{r.date}</span>
                  <Big k={k} size={36} color={good ? UP : c.pink}><Count value={r.value} start={at + 4} dur={20} /></Big>
                </div>
                <div style={{ fontWeight: 700, fontSize: 34 * k, marginTop: 2 * k }}>{t(r.label)}</div>
                <div style={{ marginTop: 8 * k }}>
                  <Bar k={k} at={at + 6} to={r.bar} color={good ? c.lime : c.pink} h={10} />
                </div>
              </div>
            </Row>
          );
        })}
      </div>
      <Sfx name="swipe" at={0} volume={0.5} />
      {d.rows.map((_, i) => <Sfx key={i} name="pop" at={24 + i * 14} volume={0.3} />)}
    </Sheet>
  );
};

const GasWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "gas" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const frame = useCurrentFrame();
  // Les équivalences défilent une à une, comme le bouton "ANOTHER →" du site.
  const EQ = 70;
  const per = 26;
  const ei = Math.min(d.equivalents.length - 1, Math.max(0, Math.floor((frame - EQ) / per)));
  const eq = d.equivalents[ei];
  const local = frame - EQ - ei * per;
  const n = parseInt(eq.n, 10) || 1;
  return (
    <Sheet c={c} form={d.form} title={t(d.title)}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 26 * k }}>
        <Stamp at={8} rot={-2}>
          <div style={{ background: c.pink, border: `${4 * k}px solid ${INK}`, boxShadow: `${10 * k}px ${10 * k}px 0 ${INK}`, padding: `${12 * k}px ${22 * k}px ${16 * k}px` }}>
            <div style={mono(k, 17)}>{t(d.label)}</div>
            <Big k={k} size={118}><Count value={d.burned} start={10} dur={30} /></Big>
          </div>
        </Stamp>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 * k, paddingBottom: 8 * k }}>
          {d.cells.map((cell, i) => (
            <Row key={i} at={34 + i * 6} k={k} style={{ display: "flex", alignItems: "baseline", gap: 12 * k }}>
              <Big k={k} size={40}><Count value={cell.value} start={36 + i * 6} dur={20} /></Big>
              <span style={mono(k, 15, "#6b675d")}>{t(cell.label)}</span>
            </Row>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 28 * k, background: INK, color: PAPER, padding: `${18 * k}px ${24 * k}px`, minHeight: 210 * k, opacity: frame < EQ ? 0 : 1, overflow: "hidden", position: "relative" }}>
        <div style={mono(k, 17, c.lime)}>{t(d.thats)}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 * k, transform: `translateY(${interpolate(local, [0, 8], [40, 0], { ...clamp, easing: EASE_OUT }) * k}px)`, opacity: interpolate(local, [0, 6], [0, 1], clamp) }}>
          <Big k={k} size={84} color={PAPER}><Count value={eq.n} start={EQ + ei * per} dur={14} /></Big>
          <Big k={k} size={54} color={PAPER}>{t(eq.label)}</Big>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 * k, marginTop: 10 * k, fontSize: 40 * k, lineHeight: 1 }}>
          {Array.from({ length: Math.min(n, 12) }).map((_, j) => {
            const pj = interpolate(local, [4 + j * 1.2, 10 + j * 1.2], [0, 1], { ...clamp, easing: EASE_OUT });
            return <span key={j} style={{ display: "inline-block", transform: `scale(${pj}) rotate(${(1 - pj) * 40}deg)` }}>{eq.emoji}</span>;
          })}
        </div>
      </div>
      <Sfx name="pop" at={8} volume={0.6} />
      {d.equivalents.map((_, i) => <Sfx key={i} name="swipe" at={EQ + i * per} volume={0.4} />)}
    </Sheet>
  );
};

/** Glyphes SEAL du site (formes pleines 24×24, détail découpé). */
const SEALS: Record<string, { d: string; fd: string; d2?: string }> = {
  CHECKBOX: { d: "M3 3 H21 V21 H3 Z", fd: "M10.3 17.5 L5.5 12.7 L7.6 10.6 L10.3 13.3 L16.6 7 L18.7 9.1 Z" },
  DROPCUT: { d: "M12 1.5 L19 11 A7 7 0 1 1 5 11 Z", fd: "M12 6.5 L16 11.6 A4 4 0 1 1 8 11.6 Z", d2: "M4.6 20.8 L2.8 19 L19.4 2.4 L21.2 4.2 Z" },
  PUMP: { d: "M3 3.5 H14 V22 H3 Z M15 8 H17.5 V17 A2 2 0 0 0 20.5 17 V11.5 H18.5 V9 H22.5 V17 A4.6 4.6 0 0 1 15 17 Z", fd: "M5.5 6.5 H11.5 V12 H5.5 Z" },
  MOON: { d: "M18.5 15.5 A8.5 8.5 0 1 1 9 6 A6.8 6.8 0 0 0 18.5 15.5 Z M19.5 3 L20.7 6.1 L23.8 7.3 L20.7 8.5 L19.5 11.6 L18.3 8.5 L15.2 7.3 L18.3 6.1 Z", fd: "" },
  DIAMOND: { d: "M12 2 L21 11 L12 20 L3 11 Z M3 21.5 H21 V23.5 H3 Z", fd: "M12 7 L16 11 L12 15 L8 11 Z" },
};

const TrophiesWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "trophies" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const frame = useCurrentFrame();
  return (
    <Sheet c={c} form={d.form} title={t(d.title)} dark shadow={c.lime}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 * k }}>
        <span style={mono(k, 16, PAPER)}>{t(d.caseLabel)}</span>
        <span style={mono(k, 16, "#9a958a")}><Count value={d.held} start={10} dur={40} /></span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 * k }}>
        {d.items.map((it, i) => {
          const col = tone(c, it.color);
          const seal = SEALS[it.icon] ?? SEALS.CHECKBOX;
          const at = 14 + i * 11;
          return (
            <Row key={i} at={at} k={k} style={{ display: "flex", alignItems: "center", gap: 18 * k, border: `${3 * k}px solid ${col}`, background: "rgba(255,255,255,.04)", padding: `${12 * k}px ${16 * k}px`, position: "relative" }}>
              <div style={{ width: 62 * k, height: 62 * k, background: col, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width={40 * k} height={40 * k}>
                  <path d={seal.d} fill={INK} />
                  {seal.fd ? <path d={seal.fd} fill={col} /> : null}
                  {seal.d2 ? <path d={seal.d2} fill={INK} /> : null}
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...mono(k, 24, PAPER), letterSpacing: "0.04em" }}>{t(it.name)}</div>
                <div style={{ fontSize: 26 * k, color: "#bdb7aa", marginTop: 2 * k, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(it.text)}</div>
              </div>
              <Stamp at={at + 10} rot={-6}>
                <span style={{ ...mono(k, 15, col), border: `${2 * k}px solid ${col}`, padding: `${4 * k}px ${8 * k}px` }}>{t(d.heldLabel)}</span>
              </Stamp>
            </Row>
          );
        })}
        {d.almost ? (
          <Row at={14 + d.items.length * 11} k={k} style={{ border: `${3 * k}px dashed #6b675d`, padding: `${12 * k}px ${16 * k}px` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={mono(k, 15, "#9a958a")}>{t(d.almost.label)}</span>
              <span style={mono(k, 15, c.lime)}>{t(d.almost.hint)}</span>
            </div>
            <div style={{ ...mono(k, 26, PAPER), margin: `${6 * k}px 0 ${10 * k}px` }}>{t(d.almost.name)}</div>
            <div style={{ height: 14 * k, background: "rgba(239,234,223,.12)" }}>
              <div style={{ height: "100%", width: `${d.almost.progress * 100 * interpolate(frame, [30 + d.items.length * 11, 70 + d.items.length * 11], [0, 1], { ...clamp, easing: EASE_OUT })}%`, background: c.lime }} />
            </div>
          </Row>
        ) : null}
      </div>
      <Sfx name="swipe" at={0} volume={0.5} />
      {d.items.map((_, i) => <Sfx key={i} name="pop" at={24 + i * 11} volume={0.35} />)}
    </Sheet>
  );
};

const MathWidget: React.FC<{ c: Ctx; d: Extract<Widget, { type: "math" }> }> = ({ c, d }) => {
  const { k, t } = c;
  const frame = useCurrentFrame();
  // Les formules se tapent ligne par ligne dans le bloc noir.
  const all = d.formulas.map((f) => (typeof f === "string" ? f : t(f))).join("\n");
  const typed = Math.floor(interpolate(frame, [12, 12 + all.length * 0.55], [0, all.length], clamp));
  const shown = all.slice(0, typed).split("\n");
  // Puis les lots FIFO : la vente consomme les plus anciens d'abord.
  const LOTS = 18 + all.length * 0.55;
  return (
    <Sheet c={c} form={d.form} title={t(d.title)}>
      <div style={{ background: INK, border: `${3 * k}px solid ${INK}`, boxShadow: `${8 * k}px ${8 * k}px 0 ${c.pink}`, padding: `${18 * k}px ${22 * k}px`, minHeight: d.formulas.length * 44 * k }}>
        {shown.map((l, i) => (
          <div key={i} style={{ ...mono(k, Math.min(24, 800 / (Math.max(...all.split("\n").map((x) => x.length)) * 0.63 * 1.4)), i % 2 ? c.cyan : c.lime), textTransform: "none", letterSpacing: "0.01em", lineHeight: 1.6, whiteSpace: "pre" }}>
            {l}
            {i === shown.length - 1 ? <span style={{ color: PAPER, opacity: Math.floor(frame / 8) % 2 ? 1 : 0 }}>▍</span> : null}
          </div>
        ))}
      </div>
      <div style={{ ...mono(k, 16, "#6b675d"), marginTop: 28 * k }}>{t(d.lotsLabel)}</div>
      <div style={{ display: "flex", gap: 10 * k, marginTop: 12 * k }}>
        {d.lots.map((lot, i) => {
          const at = LOTS + i * 6;
          const p = interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: EASE_OUT });
          const used = interpolate(frame, [LOTS + 22 + i * 9, LOTS + 32 + i * 9], [0, 1], { ...clamp, easing: EASE_IN_OUT }) * lot.used;
          return (
            <div key={i} style={{ flex: 1, border: `${3 * k}px solid ${INK}`, background: "#fff", transform: `translateY(${(1 - p) * 40 * k}px)`, opacity: p, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${used * 100}%`, background: `repeating-linear-gradient(-45deg, ${c.pink} 0 ${5 * k}px, transparent ${5 * k}px ${10 * k}px)` }} />
              <div style={{ position: "relative", padding: `${10 * k}px ${12 * k}px` }}>
                <div style={mono(k, 14, "#6b675d")}>LOT {i + 1}</div>
                <Big k={k} size={34}>{lot.qty}</Big>
                <div style={mono(k, 13, "#6b675d")}>{lot.at}</div>
              </div>
            </div>
          );
        })}
      </div>
      <Sfx name="swipe" at={0} volume={0.5} />
      {Array.from({ length: Math.ceil(all.length / 6) }).map((_, i) => <Sfx key={i} name="click" at={12 + i * 3.3} volume={0.18} />)}
      {d.lots.map((_, i) => <Sfx key={i} name="pop" at={LOTS + 22 + i * 9} volume={0.3} />)}
    </Sheet>
  );
};

/** Widget animé d'une feature (choisi par `widget.type`). */
export const FeatureWidget: React.FC<{ widget: Widget; width: number }> = ({ widget, width }) => {
  const c = useCtx(width);
  switch (widget.type) {
    case "pnl": return <PnlWidget c={c} d={widget} />;
    case "address": return <AddressWidget c={c} d={widget} />;
    case "grade": return <GradeWidget c={c} d={widget} />;
    case "whatif": return <WhatIfWidget c={c} d={widget} />;
    case "regrets": return <RegretsWidget c={c} d={widget} />;
    case "gas": return <GasWidget c={c} d={widget} />;
    case "trophies": return <TrophiesWidget c={c} d={widget} />;
    case "math": return <MathWidget c={c} d={widget} />;
    default: return null;
  }
};
