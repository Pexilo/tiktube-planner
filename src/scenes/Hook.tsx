import React from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, useTheme } from "../lib/theme";
import { Particles } from "../components/pro";
import { Backdrop, Flash, Marquee, SceneWrap, Sfx, useShake } from "../components/fx";
import { Kinetic, tokenize } from "../components/text";
import { BAR } from "../../shared/timeline.mjs";

/**
 * Phase 1 : chaque mot seul, plein écran, un par temps fort, fonds inversés (flash cuts).
 * Phase 2 : la phrase complète claque.
 */
const WordFlash: React.FC<{ words: { w: string; hl: boolean; suffix?: string }[]; step: number }> = ({ words, step }) => {
  const { b, u, W, isShort, dark } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const i = Math.min(words.length - 1, Math.floor(frame / step));
  const local = frame - i * step;
  const p = spring({ frame: local, fps, config: { damping: 12, stiffness: 320, mass: 0.5 } });
  const inv = i % 2 === 1 || words[i].hl;
  const bg = inv ? b.primary : dark ? b.bg : b.text;
  const fg = inv ? (dark ? b.bg : "#fff") : dark ? "#fff" : b.bg;
  const txt = words[i].w + (words[i].suffix ?? "").replace(/\u00A0/g, "");
  const base = (isShort ? 300 : 260) * u;
  const size = Math.min(base, ((W - 120 * u) / Math.max(3, txt.length)) * 1.75);
  return (
    <AbsoluteFill style={{ background: bg, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <div
        style={{
          fontFamily: font(b.heading),
          fontWeight: b.headingWeight,
          fontSize: b.heading === "Anton" ? size * 1.15 : size,
          letterSpacing: "-0.04em",
          color: fg,
          textTransform: b.uppercase ? "uppercase" : undefined,
          transform: `scale(${1.6 - 0.6 * p}) rotate(${(1 - p) * (i % 2 ? 6 : -6)}deg)`,
          filter: p < 0.9 ? `blur(${(1 - p) * 14}px)` : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {txt}
      </div>
    </AbsoluteFill>
  );
};

/** Une ligne d'accroche qui claque mot par mot, avec secousse caméra. */
const HookLine: React.FC<{ text: string; seed: number; last: boolean; dur?: number }> = ({ text, seed, last, dur = BAR }) => {
  const { u, isShort, W } = useTheme();
  const tokens = tokenize(text);
  const stagger = tokens.length > 6 ? 3 : 4;
  const hits = tokens.map((_, i) => i * stagger);
  const shake = useShake(tokens.length <= 5 ? [tokens.length * 5] : hits, 9 * u, 5);
  const hl = tokens.filter((t) => t.hl).map((t) => t.w).join(" ") || tokens[tokens.length - 1].w;
  const size = (isShort ? (tokens.length > 5 ? 132 : 158) : tokens.length > 5 ? 124 : 148) * u;
  // Flash mot par mot seulement si la ligne est courte (sinon illisible en 2 s).
  const step = 0; // plus de "flash" mot par mot
  const flashEnd = step * tokens.length;
  return (
    <SceneWrap dur={dur} push={0.08} exit={!last}>
      <Backdrop seed={seed} intensity={1.15} />
      <Marquee text={hl.replace(/[?!.,…]/g, "")} y={(isShort ? 330 : 90) * u} size={(isShort ? 260 : 220) * u} speed={9 * u} />
      <Marquee text={hl.replace(/[?!.,…]/g, "")} y={(isShort ? 1250 : 760) * u} size={(isShort ? 260 : 220) * u} speed={7 * u} reverse />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: shake }}>
        <Kinetic text={text} size={size} mode="rise" start={flashEnd} stagger={flashEnd ? 2 : stagger} maxWidth={W - (isShort ? 120 : 240) * u} exitAt={dur - 8} />
      </AbsoluteFill>
      <Particles count={18} seed={seed} />
      {flashEnd ? (
        <Sequence durationInFrames={flashEnd} layout="none">
          <WordFlash words={tokens} step={step} />
        </Sequence>
      ) : null}
      <Flash at={flashEnd} strength={0.4} />
      <Sfx name="hit" at={0} volume={0.9} />
      <Sfx name="whoosh-fast" at={1} volume={0.45} />
      {flashEnd
        ? tokens.map((_, k) => <Sfx key={k} name={k === 0 ? "hit" : "click"} at={k * step} volume={k === 0 ? 0.3 : 0.55} />)
        : hits.slice(1).map((h) => <Sfx key={h} name="tick" at={h} volume={0.35} />)}
      {flashEnd ? <Sfx name="hit" at={flashEnd} volume={0.7} /> : null}
    </SceneWrap>
  );
};

export const HookScene: React.FC<{ lines: string[]; lineDur?: number }> = ({ lines, lineDur = BAR }) => (
  <>
    {lines.map((l, i) => (
      <Sequence key={i} from={i * lineDur} durationInFrames={lineDur}>
        <HookLine text={l} seed={i + 1} last={false} dur={lineDur} />
      </Sequence>
    ))}
  </>
);
