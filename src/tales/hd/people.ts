// Personnages HD : des marionnettes comme les sprites 12 × 20 de la grille historique (membres = segments orientés par
// des angles), mais trois fois plus détaillées (≈ 60 cellules ≈ 1,60 m, grosse tête lisible) : visage de profil,
// cheveux, lunettes, plis d'ombre. Chaque pièce suit la même règle d'ombrage (draw.ts : part), donc tout le casting
// sort de la même main. Origine = sol sous la hanche ; profil tourné vers la droite.
import { Canvas } from "../pixel/engine";
import { go, part, type Pt } from "./draw";
import { RAMPS, type RampName } from "./palette";

export type HDLook = {
  shirt: RampName;
  shirtStep?: number;
  pants: RampName;
  pantsStep?: number;
  /** Ton des cheveux dans la rampe `hair` (1 = brun noir, 2 = châtain, 4 = blond). */
  hair?: number;
  glasses?: boolean;
  /** Casquette (couleur de la rampe), visière vers l'avant. */
  cap?: RampName;
  sleeves?: "short" | "long";
};
export type HDPose = "stand" | "walk" | "type" | "phone";

/** Angles (degrés, 0 = vers le bas, 90 = vers l'avant) : bras [épaule, coude], jambes [hanche, genou], buste penché. */
function rig(pose: HDPose, t: number) {
  if (pose === "type") {
    const tap = Math.floor(t / 3) % 2;
    return { hip: 14, lean: 7, armF: [30, 62 + 6 * tap], armN: [24, 68 - 6 * tap], legF: [84, -84], legN: [90, -90] };
  }
  if (pose === "walk") {
    const ph = ((Math.floor(t / 3) % 8) / 8) * Math.PI * 2;
    const s = Math.sin(ph);
    return { hip: 25, lean: 3, armF: [-24 * s, 16], armN: [24 * s, 16], legF: [26 * s, -Math.max(0, 34 * Math.sin(ph + 1.3))], legN: [-26 * s, -Math.max(0, -34 * Math.sin(ph + 1.3))] };
  }
  if (pose === "phone") return { hip: 25, lean: 2, armF: [7, 6], armN: [20, 132], legF: [3, -2], legN: [-3, 2] };
  return { hip: 25, lean: 0, armF: [7, 6], armN: [-5, 9], legF: [3, -2], legN: [-3, 2] };
}

export function hdPerson(look: HDLook, pose: HDPose = "stand", t = 0): Canvas {
  const c = new Canvas();
  const r = rig(pose, t);
  const hip: Pt = [0, -r.hip];
  const sh = go(hip, 180 - r.lean, 16);
  const head = go(sh, 180 - r.lean, 11);
  const [s0, p0] = [look.shirtStep ?? 3, look.pantsStep ?? 3];
  const leg = ([a, k]: number[], dark: number) => {
    const knee = go(hip, a, 12);
    const ankle = go(knee, a + k, 11);
    part(c, (m) => m.limb(...hip, ...knee, 6.6, "#000").limb(...knee, ...ankle, 5.6, "#000"), look.pants, p0 - dark);
    part(c, (m) => m.rect(Math.round(ankle[0]) - 2, Math.round(ankle[1]) - 1, 7, 3, "#000").rect(Math.round(ankle[0]) - 2, Math.round(ankle[1]) - 2, 4, 1, "#000"), "ink", 4 - dark);
  };
  const arm = ([a, k]: number[], dark: number) => {
    const elbow = go(sh, a, 10);
    const hand = go(elbow, a + k, 8.5);
    const long = look.sleeves === "long";
    part(c, (m) => m.limb(...sh, ...elbow, 4.8, "#000"), look.shirt, s0 - dark);
    part(c, (m) => m.limb(...elbow, ...hand, 4, "#000"), long ? look.shirt : "skin", (long ? s0 : 3) - dark);
    part(c, (m) => m.circle(hand[0], hand[1], 2.4, "#000"), "skin", 3 - dark);
  };
  // Du fond vers l'avant : jambe et bras du fond (un ton plus sombres), bassin, buste, jambe avant, cou, tête, bras avant.
  leg(r.legF, 1);
  arm(r.armF, 1);
  part(c, (m) => m.limb(hip[0] - 1, hip[1], hip[0] + 1, hip[1], 10, "#000"), look.pants, p0);
  part(c, (m) => m.limb(hip[0], hip[1] - 2, sh[0], sh[1] + 2.5, 11.5, "#000"), look.shirt, s0);
  leg(r.legN, 0);
  part(c, (m) => m.limb(sh[0] + 0.5, sh[1] + 1, head[0], head[1] + 6, 4.4, "#000"), "skin", 2, false);
  face(c, head, look);
  arm(r.armN, 0);
  if (pose === "phone") {
    // Téléphone dans la main avant : boîtier encre, écran allumé.
    const hand = go(go(sh, r.armN[0], 10), r.armN[0] + r.armN[1], 8.5);
    part(c, (m) => m.rect(Math.round(hand[0]) + 1, Math.round(hand[1]) - 4, 3, 5, "#000"), "ink", 3);
    c.rect(Math.round(hand[0]) + 2, Math.round(hand[1]) - 3, 1, 2, RAMPS.cyan[3]);
  }
  return c;
}

/** Tête de profil : crâne, nez, oreille, cheveux (calotte + nuque), œil, sourcil, bouche, lunettes. */
function face(c: Canvas, h: Pt, look: HDLook) {
  const [hx, hy] = [Math.round(h[0]), Math.round(h[1])];
  const [H, S, I] = [RAMPS.hair, RAMPS.skin, RAMPS.ink];
  const set = (x: number, y: number, col: string) => c.set(hx + x, hy + y, col);
  part(c, (m) => m.circle(hx + 0.5, hy + 0.5, 8.6, "#000"), "skin", 3);
  part(c, (m) => m.rect(hx + 8, hy - 1, 2, 3, "#000").rect(hx + 7, hy + 5, 2, 2, "#000"), "skin", 3, false);
  // Cheveux : calotte (jusqu'au haut du front), nuque et favori ; le visage reste dégagé.
  const hb = look.hair ?? 2;
  part(c, (m) => m.circle(hx, hy - 0.5, 9.3, "#000", (x, y) => y < hy - 4 + (x < hx - 1 ? 2 : 0) + (x > hx + 5 ? 1 : 0) || (x < hx - 3 && y < hy + 5)), "hair", hb);
  part(c, (m) => m.circle(hx - 1, hy + 2, 2.2, "#000"), "skin", 2);
  set(-1, 2, S[1]);
  if (look.cap) {
    // Casquette : calotte sur le haut du crâne, visière qui dépasse vers l'avant, bouton.
    part(c, (m) => m.circle(hx, hy - 1, 9.6, "#000", (x, y) => y < hy - 3), look.cap, 3);
    part(c, (m) => m.rect(hx + 5, hy - 4, 8, 2, "#000"), look.cap, 2);
    set(0, -10, RAMPS[look.cap][4]);
  }
  for (const x of [-5, -2, 1, 4]) set(x, -8, H[Math.min(4, hb + 1)]);
  // Sourcil, œil (2 cellules), bouche.
  for (const x of [4, 5, 6]) set(x, -2, H[1]);
  set(5, 0, I[1]);
  set(5, 1, I[1]);
  set(6, 5, S[1]);
  set(7, 5, S[1]);
  if (look.glasses) {
    // Monture fine (ton encre moyen) autour d'un verre clair, l'œil au milieu ; branche jusqu'à l'oreille.
    for (const [x, y] of [[4, -1], [5, -1], [6, -1], [7, -1], [7, 0], [7, 1], [4, 2], [5, 2], [6, 2], [7, 2], [3, 0], [3, 1]]) set(x, y, I[4]);
    for (const [x, y] of [[4, 0], [4, 1], [6, 0], [6, 1]]) set(x, y, RAMPS.cyan[4]);
    for (let x = 0; x < 3; x++) set(x, 0, I[4]);
  }
}
