// Ancien kit « encre » (schémas 2D) : gardé pour les stories composées avant le passage au pixel art.
// Les nouvelles stories utilisent ../kit (pixel art, cf. src/tales/KIT.md). À recomposer puis supprimer.
export { INK, PAPER, PAPER_2, GREY, PINK, LIME, CYAN, ORANGE, UP, STAGE_W, STAGE_H, Beat, useBeat, useTale, useEnter, useProgress, Camera, At, Appear, Board, monoStyle } from "../kit/core";
export type { CameraKey, From } from "../kit/core";
export { InkPath, Arrow, Tag, Transfer, Coin, Chain, PriceChart, Timeline, Callout, Redacted, Gauge } from "./draw";
export { Icon, ICON_NAMES, Actor, Bubble, Wallet, Headline, Stamp, Counter, Title, Note, Pin } from "./things";
export type { IconName, ActorKind } from "./things";
