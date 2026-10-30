// Sources dessinées (SVG) des objets de la story pizza : le pixeliseur les traite exactement comme une vraie photo.
// Dessinées grandes, avec dégradés et matières (carton, fromage, métal), lumière en haut à gauche, couleurs déjà prises
// dans la palette HD. Chaque source peut être remplacée par une photo ou un logo réel (public/tales/hd/…) sans toucher
// au plan : seul `src` change.
import { tone } from "./palette";

/** SVG → URL utilisable comme source d'image. */
export const svgUrl = (body: string, w: number, h: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

/** Dégradé linéaire nommé `id` (de (0, 0) vers (x2, y2), en fraction de la forme) : stops [position, couleur, opacité]. */
export const lin = (id: string, x2: number, y2: number, stops: [number, string, number?][]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`;
/** Dégradé radial nommé `id` (centre cx, cy et rayon r en fraction de la forme). */
export const rad = (id: string, cx: number, cy: number, r: number, stops: [number, string, number?][]) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;

/** Symbole ₿ (logo Bitcoin, domaine public) dans un carré de 100, incliné de 14°. */
const btc = (fill: string) =>
  `<g transform="rotate(14 50 50)" fill="${fill}" fill-rule="evenodd">
    <path d="M30 20H57C68 20 74 27 74 35C74 43 68 50 57 50H30ZM42 30H55C60 30 62 32 62 35C62 38 60 40 55 40H42Z"/>
    <path d="M30 50H61C72 50 78 57 78 65C78 73 72 80 61 80H30ZM42 60H59C64 60 66 62 66 65C66 68 64 70 59 70H42Z"/>
    <rect x="30" y="20" width="12" height="60"/><rect x="35" y="11" width="6" height="10"/><rect x="48" y="11" width="6" height="10"/>
    <rect x="35" y="79" width="6" height="10"/><rect x="48" y="79" width="6" height="10"/>
  </g>`;

/* ------------------------------------------------------------------ Boîte à pizza */

/**
 * Boîte fermée, vue de face et d'un peu au-dessus (400 × 178) : couvercle imprimé (ovale « PIZZA », liseré, tache de
 * gras), rabat du couvercle, tranche du bac avec ses poignées. `FRONT` = hauteur de la tranche (pour empiler).
 */
export const BOX_FRONT = 52 / 178;
export const pizzaBoxClosed = () =>
  svgUrl(
    `<defs>
      ${lin("l", 0.3, 1, [[0, tone("stone", 5)], [0.55, tone("stone", 6)], [1, tone("stone", 7)]])}
      ${lin("f", 0, 1, [[0, tone("stone", 4)], [1, tone("stone", 3)]])}
      ${lin("r", 1, 0, [[0.5, "#000", 0], [1, "#000", 0.2]])}
      ${rad("g", 0.5, 0.5, 0.5, [[0, tone("orange", 3), 0.6], [1, tone("orange", 3), 0]])}
    </defs>
    <path d="M28 8H372L394 126H6Z" fill="url(#l)"/>
    <path d="M44 19H356L373 116H27Z" fill="none" stroke="${tone("pink", 3)}" stroke-width="6"/>
    <ellipse cx="206" cy="66" rx="104" ry="38" fill="${tone("tomato", 1)}"/>
    <ellipse cx="202" cy="63" rx="104" ry="38" fill="${tone("tomato", 3)}"/>
    <ellipse cx="202" cy="63" rx="94" ry="32" fill="none" stroke="${tone("stone", 7)}" stroke-width="3"/>
    <text x="202" y="0" transform="translate(0 79) scale(1 .62)" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-weight="900" font-size="66" letter-spacing="3" fill="${tone("stone", 7)}">PIZZA</text>
    <path d="M78 63l6 -6 6 6 -6 6zM314 63l6 -6 6 6 -6 6z" fill="${tone("pink", 3)}"/>
    <ellipse cx="318" cy="102" rx="34" ry="11" fill="url(#g)"/>
    <ellipse cx="96" cy="104" rx="16" ry="6" fill="url(#g)"/>
    <path d="M28 8H372L394 126H6Z" fill="url(#r)"/>
    <path d="M6 126H394V148H6Z" fill="${tone("stone", 6)}"/>
    <rect x="6" y="126" width="388" height="4" fill="${tone("stone", 7)}"/>
    <path d="M6 148H394V176H6Z" fill="url(#f)"/>
    <rect x="6" y="147" width="388" height="3" fill="${tone("stone", 1)}"/>
    <path d="M6 152${Array.from({ length: 49 }, (_, i) => `q4 ${i % 2 ? 3 : -3} 8 0`).join("")}" fill="none" stroke="${tone("stone", 2)}" stroke-width="2"/>
    <rect x="44" y="160" width="46" height="9" rx="4.5" fill="${tone("stone", 1)}"/>
    <rect x="310" y="160" width="46" height="9" rx="4.5" fill="${tone("stone", 1)}"/>
    <path d="M6 126H394V176H6Z" fill="url(#r)"/>`,
    400,
    178,
  );

/** Pepperoni (décalage depuis le centre de la garniture). */
const PEPPERONI: [number, number][] = [[-100, -14], [-58, -34], [-14, -40], [40, -30], [92, -20], [128, 4], [-128, 6], [-82, 10], [-30, -6], [24, 6], [78, 14], [-50, 34], [6, 36], [60, 36], [106, 24], [-100, 30]];

/** Boîte ouverte (400 × 340) : couvercle relevé (carton brut, taches de gras), bac, pizza pepperoni coupée en 8. */
export const pizzaBoxOpen = () => {
  const [cx, cy] = [200, 236];
  const cuts = [0, 45, 90, 135].map((a) => {
    const [dx, dy] = [151 * Math.cos((a * Math.PI) / 180), 51 * Math.sin((a * Math.PI) / 180)];
    return `<path d="M${cx - dx} ${cy - dy}L${cx + dx} ${cy + dy}" stroke="${tone("orange", 2)}" stroke-width="3" stroke-opacity=".75"/>`;
  });
  const peps = PEPPERONI.map(
    ([x, y]) =>
      `<ellipse cx="${cx + x}" cy="${cy + y}" rx="17" ry="7.5" fill="${tone("tomato", 3)}" stroke="${tone("tomato", 1)}" stroke-width="2.5"/>
       <ellipse cx="${cx + x - 5}" cy="${cy + y - 2.5}" rx="6" ry="2" fill="${tone("tomato", 5)}" opacity=".8"/>
       <circle cx="${cx + x + 6}" cy="${cy + y + 1}" r="1.6" fill="${tone("tomato", 1)}"/>`,
  );
  const peppers = [[-120, -24], [-34, 20], [52, -14], [110, 40], [-70, -10], [20, -44]].map(
    ([x, y]) => `<path d="M${cx + x} ${cy + y}q8 -6 16 0" fill="none" stroke="${tone("lime", 2)}" stroke-width="3.5" stroke-linecap="round"/>`,
  );
  const toast = [[-150, -10], [-120, -40], [-40, -56], [60, -55], [140, -24], [150, 18], [90, 52], [-20, 58], [-130, 36]].map(
    ([x, y]) => `<ellipse cx="${cx + x}" cy="${cy + y}" rx="7" ry="3" fill="${tone("orange", 1)}" opacity=".6"/>`,
  );
  return svgUrl(
    `<defs>
      ${lin("lid", 0, 1, [[0, tone("stone", 5)], [0.7, tone("stone", 4)], [1, tone("stone", 3)]])}
      ${lin("fl", 0, 1, [[0, tone("stone", 4)], [0.3, tone("stone", 6)], [1, tone("stone", 6)]])}
      ${lin("f", 0, 1, [[0, tone("stone", 5)], [1, tone("stone", 3)]])}
      ${rad("crust", 0.4, 0.35, 0.7, [[0, tone("orange", 4)], [0.75, tone("orange", 3)], [1, tone("orange", 2)]])}
      ${rad("g", 0.5, 0.5, 0.5, [[0, tone("orange", 3), 0.45], [1, tone("orange", 3), 0]])}
      <filter id="ch" x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency="0.028 0.07" numOctaves="3" seed="4"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.97  0 0 0 0 0.58  0 0 0 0 0.1  3.2 0 0 0 -1.5"/>
        <feComposite in2="SourceGraphic" operator="atop"/>
      </filter>
    </defs>
    <path d="M36 158L50 12H350L364 158Z" fill="url(#lid)"/>
    <path d="M50 12H350L349 21H51Z" fill="${tone("stone", 7)}"/>
    <ellipse cx="120" cy="70" rx="38" ry="22" fill="url(#g)"/><ellipse cx="290" cy="112" rx="26" ry="15" fill="url(#g)"/>
    <path d="M30 158H370L394 300H6Z" fill="${tone("stone", 4)}"/>
    <path d="M42 168H358L378 290H22Z" fill="url(#fl)"/>
    <ellipse cx="${cx + 8}" cy="${cy + 8}" rx="168" ry="58" fill="${tone("stone", 2)}" opacity=".55"/>
    <ellipse cx="${cx}" cy="${cy}" rx="170" ry="60" fill="url(#crust)"/>
    <path d="M${cx - 160} ${cy - 8}Q${cx - 120} ${cy - 56} ${cx} ${cy - 58}" fill="none" stroke="${tone("orange", 5)}" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    ${toast.join("")}
    <ellipse cx="${cx}" cy="${cy}" rx="152" ry="51" fill="${tone("orange", 5)}" filter="url(#ch)"/>
    ${cuts.join("")}
    ${peppers.join("")}
    ${peps.join("")}
    <path d="M22 290H378L394 300H6Z" fill="${tone("stone", 6)}"/>
    <path d="M6 300H394V334H6Z" fill="url(#f)"/>
    <rect x="6" y="300" width="388" height="4" fill="${tone("stone", 7)}"/>
    <rect x="46" y="316" width="44" height="8" rx="4" fill="${tone("stone", 1)}"/>
    <rect x="310" y="316" width="44" height="8" rx="4" fill="${tone("stone", 1)}"/>`,
    400,
    340,
  );
};

/* ------------------------------------------------------------------ Bitcoins */

const coinDefs = `${lin("e", 1, 0, [[0, tone("orange", 4)], [0.35, tone("orange", 3)], [1, tone("orange", 1)]])}
  ${rad("fc", 0.35, 0.3, 0.8, [[0, tone("orange", 6)], [0.45, tone("orange", 4)], [1, tone("orange", 2)]])}`;

/** Piles de pièces (300 × 220) : chaque pièce = tranche (dégradé) + face ; seule la face du haut se voit. */
export const coinStacks = (stacks: [number, number, number][] = [[78, 196, 12], [150, 212, 17], [224, 202, 9]]) => {
  const coin = (x: number, y: number, top: boolean) =>
    `<path d="M${x - 34} ${y}a34 12 0 0 0 68 0v7a34 12 0 0 1 -68 0z" fill="url(#e)"/>
     <path d="M${x - 34} ${y + 3.5}a34 12 0 0 0 68 0" fill="none" stroke="${tone("orange", 1)}" stroke-width="1.2" opacity=".7"/>
     <ellipse cx="${x}" cy="${y}" rx="34" ry="12" fill="url(#fc)"/>
     ${top ? `<ellipse cx="${x}" cy="${y}" rx="25" ry="8" fill="none" stroke="${tone("orange", 2)}" stroke-width="3"/>` : ""}`;
  const body = [...stacks]
    .sort((a, b) => a[1] - b[1])
    .map(([x, base, n]) => Array.from({ length: n }, (_, i) => coin(x + (((i * 7 + x) % 5) - 2), base - 12 - i * 7, i === n - 1)).join(""))
    .join("");
  return svgUrl(`<defs>${coinDefs}</defs>${body}`, 300, 220);
};

/** Pièce Bitcoin vue de face, un peu tournée (220 × 220) : tranche à droite, listel, ₿ crème. */
export const coinHero = () =>
  svgUrl(
    `<defs>${coinDefs}</defs>
    <circle cx="118" cy="110" r="96" fill="${tone("orange", 1)}"/>
    <circle cx="112" cy="110" r="96" fill="url(#e)"/>
    <circle cx="104" cy="110" r="96" fill="url(#fc)"/>
    <circle cx="104" cy="110" r="82" fill="none" stroke="${tone("orange", 2)}" stroke-width="7"/>
    <circle cx="104" cy="110" r="88" fill="none" stroke="${tone("orange", 6)}" stroke-width="2" opacity=".7"/>
    <g transform="translate(46 52) scale(1.16)">${btc(tone("stone", 7))}</g>`,
    220,
    220,
  );

/* ------------------------------------------------------------------ Moniteur 2010 */

/** Écran cathodique beige (300 × 270), tourné vers la gauche : on voit sa tranche droite. `screen` = zone de l'écran. */
export const CRT = { w: 300, h: 270, screen: [34, 32, 204, 148] as const };
export const crtMonitor = () =>
  svgUrl(
    `<defs>
      ${lin("b", 1, 1, [[0, tone("stone", 7)], [0.5, tone("stone", 6)], [1, tone("stone", 4)]])}
      ${lin("s", 1, 0, [[0, tone("stone", 4)], [1, tone("stone", 2)]])}
      ${rad("g", 0.45, 0.4, 0.75, [[0, tone("ink", 4)], [1, tone("ink", 1)]])}
    </defs>
    <path d="M256 24L292 46V194L256 214Z" fill="url(#s)"/>
    <path d="M266 72l18 10M266 86l18 10M266 100l18 10M266 114l18 10M266 128l18 10" stroke="${tone("stone", 2)}" stroke-width="3"/>
    <rect x="8" y="10" width="252" height="212" rx="16" fill="url(#b)"/>
    <rect x="24" y="22" width="220" height="168" rx="12" fill="${tone("stone", 3)}"/>
    <rect x="30" y="28" width="210" height="156" rx="11" fill="${tone("stone", 2)}"/>
    <rect x="34" y="32" width="204" height="148" rx="10" fill="url(#g)"/>
    <path d="M46 44Q96 35 160 38L158 46Q98 45 48 58Z" fill="#fff" opacity=".08"/>
    <rect x="40" y="200" width="40" height="7" rx="2" fill="${tone("stone", 3)}"/>
    <rect x="200" y="200" width="20" height="7" rx="2" fill="${tone("stone", 3)}"/>
    <circle cx="236" cy="203.5" r="4" fill="${tone("lime", 3)}"/>
    <path d="M112 222H160L168 242H104Z" fill="${tone("stone", 4)}"/>
    <path d="M50 248a86 14 0 0 0 172 0v8a86 14 0 0 1 -172 0z" fill="${tone("stone", 3)}"/>
    <ellipse cx="136" cy="248" rx="86" ry="14" fill="${tone("stone", 5)}"/>`,
    300,
    270,
  );

/* ------------------------------------------------------------------ Commerce, livraison, table */

/**
 * Caisse enregistreuse de comptoir (260 × 236) : tiroir, clavier incliné, imprimante à ticket, afficheur client sur pied.
 * `display` = zone de l'afficheur (pour y écrire en texte bitmap, calque "world").
 */
export const REGISTER = { w: 260, h: 236, display: [34, 14, 64, 26] as const };
export const cashRegister = () => {
  const keys = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => {
      const y = 108 + r * 14;
      const x0 = 62 - r * 4 + c * (24 + r * 1.2);
      const hot = (r === 3 && c === 5) || (r === 0 && c === 5);
      return `<rect x="${x0}" y="${y}" width="${18 + r * 1.2}" height="9" rx="2" fill="${hot ? tone(r === 3 ? "lime" : "pink", 3) : tone(r % 2 ? "stone" : "ink", r % 2 ? 6 : 4)}"/>`;
    }).join(""),
  ).join("");
  return svgUrl(
    `<defs>
      ${lin("t", 0.3, 1, [[0, tone("stone", 6)], [1, tone("stone", 4)]])}
      ${lin("d", 0, 1, [[0, tone("stone", 4)], [1, tone("stone", 2)]])}
    </defs>
    <rect x="60" y="40" width="9" height="60" fill="${tone("ink", 4)}"/>
    <rect x="28" y="8" width="76" height="38" rx="5" fill="${tone("ink", 3)}"/>
    <rect x="34" y="14" width="64" height="26" rx="2" fill="${tone("lime", 0)}"/>
    <path d="M24 170L46 98H214L236 170Z" fill="url(#t)"/>
    <path d="M46 98H214L216 104H44Z" fill="${tone("stone", 7)}"/>
    ${keys}
    <rect x="170" y="66" width="56" height="34" rx="4" fill="${tone("stone", 5)}"/>
    <rect x="182" y="46" width="32" height="24" fill="${tone("stone", 7)}"/>
    <path d="M186 54h24M186 60h18" stroke="${tone("stone", 3)}" stroke-width="2"/>
    <rect x="12" y="168" width="236" height="62" rx="6" fill="url(#d)"/>
    <rect x="12" y="168" width="236" height="5" fill="${tone("stone", 5)}"/>
    <rect x="30" y="186" width="200" height="30" rx="3" fill="none" stroke="${tone("stone", 1)}" stroke-width="3"/>
    <rect x="114" y="196" width="32" height="7" rx="3" fill="${tone("ink", 2)}"/>
    <circle cx="212" cy="200" r="4" fill="${tone("ink", 2)}"/>`,
    260,
    236,
  );
};

/** Voiture de livraison (320 × 172), de profil vers la droite : carrosserie tomate, enseigne de pizza sur le toit. */
export const deliveryCar = () =>
  svgUrl(
    `<defs>
      ${lin("b", 0, 1, [[0, tone("tomato", 4)], [0.45, tone("tomato", 3)], [1, tone("tomato", 2)]])}
      ${lin("w", 0.4, 1, [[0, tone("cyan", 2)], [1, tone("cyan", 0)]])}
    </defs>
    <ellipse cx="164" cy="160" rx="150" ry="8" fill="${tone("ink", 1)}" opacity=".5"/>
    <rect x="176" y="10" width="64" height="26" rx="3" fill="${tone("stone", 7)}"/>
    <path d="M194 30L208 14L222 30Z" fill="${tone("orange", 4)}"/><circle cx="206" cy="24" r="2.5" fill="${tone("tomato", 2)}"/>
    <rect x="200" y="36" width="16" height="10" fill="${tone("ink", 3)}"/>
    <path d="M112 90L150 50Q156 44 166 44H246Q260 44 268 56L290 90Z" fill="url(#b)"/>
    <path d="M126 88L156 56H206V88Z" fill="url(#w)"/><path d="M214 56H248Q256 56 262 64L278 88H214Z" fill="url(#w)"/>
    <path d="M160 60L170 60L150 84H140Z" fill="#fff" opacity=".22"/>
    <path d="M22 98Q24 88 40 88H292Q308 90 310 106V130Q310 142 298 142H22Q14 142 14 130V110Q14 100 22 98Z" fill="url(#b)"/>
    <path d="M22 98H300" stroke="${tone("tomato", 5)}" stroke-width="3"/>
    <path d="M206 92V138M150 92V138" stroke="${tone("tomato", 1)}" stroke-width="2.5"/>
    <rect x="186" y="104" width="14" height="4" rx="2" fill="${tone("tomato", 1)}"/>
    <rect x="292" y="104" width="16" height="10" rx="3" fill="${tone("stone", 7)}"/>
    <rect x="14" y="104" width="10" height="12" rx="2" fill="${tone("pink", 3)}"/>
    <rect x="12" y="126" width="300" height="12" rx="5" fill="${tone("ink", 3)}"/>
    <circle cx="80" cy="138" r="30" fill="${tone("ink", 1)}"/><circle cx="246" cy="138" r="30" fill="${tone("ink", 1)}"/>
    <circle cx="80" cy="138" r="24" fill="${tone("ink", 3)}"/><circle cx="246" cy="138" r="24" fill="${tone("ink", 3)}"/>
    <circle cx="80" cy="138" r="11" fill="${tone("stone", 4)}"/><circle cx="246" cy="138" r="11" fill="${tone("stone", 4)}"/>
    <circle cx="80" cy="138" r="4" fill="${tone("ink", 2)}"/><circle cx="246" cy="138" r="4" fill="${tone("ink", 2)}"/>`,
    320,
    172,
  );

/** Part de pizza vue de dessus (150 × 150), pointe en bas : croûte, fromage, pepperoni, une goutte de gras. */
export const pizzaSlice = () =>
  svgUrl(
    `<defs>${lin("c", 0.3, 1, [[0, tone("orange", 6)], [1, tone("orange", 4)]])}</defs>
    <path d="M75 142L12 34Q75 6 138 34Z" fill="url(#c)"/>
    <path d="M12 34Q75 6 138 34L132 48Q75 22 18 48Z" fill="${tone("orange", 2)}"/>
    <path d="M20 32Q75 10 130 32" fill="none" stroke="${tone("orange", 4)}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="58" cy="66" rx="14" ry="11" fill="${tone("tomato", 3)}" stroke="${tone("tomato", 1)}" stroke-width="2.5"/>
    <ellipse cx="96" cy="72" rx="13" ry="10" fill="${tone("tomato", 3)}" stroke="${tone("tomato", 1)}" stroke-width="2.5"/>
    <ellipse cx="76" cy="106" rx="11" ry="9" fill="${tone("tomato", 3)}" stroke="${tone("tomato", 1)}" stroke-width="2.5"/>
    <ellipse cx="54" cy="63" rx="5" ry="3" fill="${tone("tomato", 5)}"/><ellipse cx="92" cy="69" rx="5" ry="3" fill="${tone("tomato", 5)}"/>
    <path d="M110 52q6 4 4 12" fill="none" stroke="${tone("lime", 2)}" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="80" cy="132" rx="5" ry="7" fill="${tone("orange", 4)}"/>`,
    150,
    150,
  );

/** Fourchette en métal (40 × 150), dents vers le bas. */
export const fork = () =>
  svgUrl(
    `<defs>${lin("m", 1, 0, [[0, tone("stone", 7)], [0.5, tone("stone", 5)], [1, tone("stone", 3)]])}</defs>
    <rect x="15" y="2" width="10" height="84" rx="5" fill="url(#m)"/>
    <path d="M8 86H32V104Q32 112 26 114V148H23V116H21.5V148H18.5V116H17V148H14V114Q8 112 8 104Z" fill="url(#m)"/>`,
    40,
    150,
  );
