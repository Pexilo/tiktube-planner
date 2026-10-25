// Kit "Crypto stories" en pixel art : tout ce qu'une story (src/tales/stories/<slug>.tsx) a le droit d'utiliser.
// Mode d'emploi : src/tales/KIT.md. Règles de style : src/tales/pixel/PIXEL.md. Positions et tailles en cellules (grille 90 × 160).
export { Beat, useBeat, useTale } from "./core";
export { P, PAL, COLS, ROWS, GROUND, LOOKS, Person, Sprite, Canvas, PixelArt, useDrop, shade } from "../pixel/engine";
export type { Look, LookName, Pose } from "../pixel/engine";
export { Sky, City, Street, Room, Hill, Prop, PROP_NAMES, propSize, Fly, Title, Counter, Label, Bubble, Stamp, Screen, Chart, Bar, Arrow, Pin } from "../pixel/props";
export type { PropName, SkyKind } from "../pixel/props";
