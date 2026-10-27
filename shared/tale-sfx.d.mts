export type SfxMode = "hit" | "swell" | "bed";
export type StorySfxName =
  | "boom" | "hit" | "riser" | "reverse" | "whoosh" | "glitch" | "drone" | "heartbeat" | "clock" | "static" | "typing" | "siren"
  | "cash" | "fall" | "shimmer" | "slam" | "gavel" | "camera";
export type AnimSfxName = "a-pop" | "a-thud" | "a-blip" | "a-stamp" | "a-count" | "a-coin" | "a-swish" | "a-type" | "a-rise" | "a-ping" | "a-twinkle" | "a-cut" | "a-tick";
export const TALE_SFX_DIR: string;
export const STORY_SFX: Record<StorySfxName, { mode: SfxMode; dur: number; gain: number; loop?: boolean; use: string; prompt: string }>;
export const STORY_SFX_NAMES: StorySfxName[];
export const ANIM_SFX: Record<AnimSfxName, number>;
export const ANIM_SFX_NAMES: AnimSfxName[];
export function sfxFile(name: StorySfxName | AnimSfxName): string;
export const MAX_SFX_PER_BEAT: number;
export function cleanSfx(list: unknown, text: string): { cue: StorySfxName; word?: string }[];
