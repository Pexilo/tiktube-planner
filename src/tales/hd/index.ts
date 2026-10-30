// Kit des stories HD : tout ce qu'une story HD (src/tales/stories/<slug>.tsx) a le droit d'utiliser, depuis "../hd".
// Kit des nouvelles stories. Mode d'emploi : src/tales/KIT.md. Règles de style : src/tales/hd/HD.md. Positions en cellules HD (180 × 320).
export { Beat, useBeat, useTale } from "../kit/core";
export { Sound } from "../kit/sfx";
export type { AnimSfxName } from "../../../shared/tale-sfx.mjs";
export { Canvas } from "../pixel/engine";
export { textWidth, wrap } from "../pixel/font";
export { CAPTION_ROW, COLS, GROUND, P, ROWS } from "./grid";
export { mixHex, RAMPS, tone } from "./palette";
export type { RampName } from "./palette";
export { Cells, Pix } from "./pixelize";
export type { PixOpts } from "./pixelize";
export { Glow, Reflect, Steam, Txt } from "./stage";
export type { Lamp, Scene } from "./stage";
export { Blink, Card, Counter, Drop, Label, Move, Person, Show, Stamp, STILL, Title } from "./motion";
export type { HDLook as Look, HDPose as Pose } from "./people";
export { bunting, chair, desk, dir, forumPost, go, keyboard, mug, part, priceTag, screenPage, stickyNote, text } from "./draw";
export type { Pt } from "./draw";
export { BOX_FRONT, cashRegister, coinHero, coinStacks, CRT, crtMonitor, deliveryCar, fork, lin, pizzaBoxClosed, pizzaBoxOpen, pizzaSlice, rad, REGISTER, svgUrl } from "./sources";
