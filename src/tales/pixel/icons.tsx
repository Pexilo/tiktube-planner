import { Canvas, PAL } from "./engine";

/*
 * Iconographie pixel des stories (symboles, 7 à 15 pixels) : crypto, argent, sécurité, justice, communication, marché.
 * Dessinées pixel par pixel : en grilles de caractères quand la forme doit être exacte, en formes simples sinon.
 * Même palette que le reste (PAL + quelques tons dérivés), contour encre ajouté au rendu.
 */

type Drawer = { w: number; h: number; draw: (c: Canvas, t: number) => void };

/** Palette des grilles de caractères. */
const C: Record<string, string> = {
  k: PAL.ink,
  K: PAL.ink3,
  w: PAL.paper,
  W: PAL.paper2,
  g: PAL.grey,
  s: "#9AA3AD",
  S: "#6E7680",
  y: "#E8C547",
  Y: "#B8962E",
  o: PAL.btc,
  p: PAL.pink,
  P: PAL.pink2,
  l: PAL.lime,
  L: PAL.lime2,
  c: PAL.cyan,
  C: PAL.cyan2,
  r: "#D64545",
  R: "#9E2B2B",
  n: "#4E9A48",
  N: "#3E7A3A",
  b: "#8A5A3A",
  B: "#6E4A30",
  u: "#3B5BA9",
  U: "#2A3F78",
};

/** Icône en grille de caractères (« . » = transparent). */
const art = (rows: string[]): Drawer => ({
  w: Math.max(...rows.map((r) => r.length)),
  h: rows.length,
  draw: (c) => rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && C[ch] && c.set(x, y, C[ch]))),
});

/** Remplit une ellipse (forme pleine). */
const ellipse = (c: Canvas, cx: number, cy: number, rx: number, ry: number, col: string) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) c.set(x, y, col);
};

export const EXTRA_ICONS = {
  /* --- Sécurité */
  shield: art(["cccccCCCCCC", "cwcccCCCCCC", "cwcccCCCCCC", "cwcccCCCCCC", "cccccCCCCCC", "cccccCCCCCC", ".ccccCCCCC.", ".ccccCCCCC.", "..cccCCCC..", "...ccCCC...", "....cCC....", ".....C....."]),
  bell: art([".....y.....", "....yyy....", "...ywyyY...", "..yywyyyY..", "..yyyyyyY..", "..yyyyyyY..", ".yyyyyyyyY.", "yyyyyyyyyyY", "YYYYYYYYYYY", "....YYY....", ".....Y....."]),
  eye: art(["....wwwww....", "..wwwcccwww..", ".wwwcckkcwww.", "wwwwcckkcwwww", ".wwwcccccwww.", "..wwwcccwww..", "....wwwww...."]),
  hwallet: art([".KKKKK.", "KKKKKKK", "KklllkK", "KklllkK", "KKKKKKK", "KKsKsKK", "KKKKKKK", "KKKKKKK", "KKKKKKK", ".sssss.", ".sSSSs.", ".sssss."]),
  magnifier: { w: 12, h: 12, draw: (c) => { c.circle(4.5, 4.5, 4.5, C.s).circle(4.5, 4.5, 3.2, C.C).set(3, 3, C.w).set(2, 4, C.w); c.line(8, 8, 11, 11, C.b).line(8, 9, 10, 11, C.B).line(9, 8, 11, 10, C.B); } },
  vault: { w: 13, h: 13, draw: (c) => { c.rect(0, 0, 13, 13, C.s).rect(1, 1, 11, 11, C.S).circle(6.5, 6.5, 3.6, C.s).circle(6.5, 6.5, 1.5, C.K).line(6, 6, 9, 3, C.k).rect(0, 2, 1, 2, C.K).rect(0, 9, 1, 2, C.K); } },
  link: { w: 13, h: 7, draw: (c) => { c.rect(0, 0, 7, 7, C.s); for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) c.del(x, y); c.rect(6, 0, 7, 7, C.S); for (let y = 2; y < 5; y++) for (let x = 8; x < 11; x++) c.del(x, y); c.rect(5, 2, 1, 3, C.s); } },
  block: art(["....ccc....", "..ccwcccc..", "ccccccccccc", "CCCCCCUUUUU", "CCCCCCUUUUU", "CCCCCCUUUUU", "CCCCCCUUUUU", "CCCCCCUUUUU", ".CCCCCUUUU.", "...CCCUU..."]),
  terminal: art(["KKKKKKKKKKKKKK", "KpKyKlKKKKKKKK", "KKKKKKKKKKKKKK", "KkkkkkkkkkkkkK", "KklkkkkkkkkkkK", "KkklkkkkkkkkkK", "KklkkllllkkkkK", "KkkkkkkkkkkkkK", "KkkkkkkkkkkkkK", "KKKKKKKKKKKKKK"]),
  robot: art([".....l.....", ".....s.....", "sssssssssss", "sKKsssssKKs", "sKcsssssKcs", "sssssssssss", "ssKKKKKKKss", "sssssssssss", ".SSSSSSSSS."]),
  qr: art(["kkkwkwkwkkk", "kwkwwkkwkwk", "kkkwkwwwkkk", "wwwkkwkwwww", "kwkwwkkwkkw", "wkkwkwwkwkw", "kwwkkwkkwwk", "wwwkwkwwwkw", "kkkwwkkwkwk", "kwkwkwwkkww", "kkkwkkwkwkk"]),
  signal: { w: 11, h: 9, draw: (c) => { c.rect(0, 7, 2, 2, C.l).rect(3, 5, 2, 4, C.l).rect(6, 3, 2, 6, C.l).rect(9, 0, 2, 9, C.L); } },
  cloud: { w: 15, h: 9, draw: (c) => { c.circle(4, 5, 3.5, C.w).circle(8, 3.6, 3.6, C.w).circle(11.6, 5, 3, C.w).rect(1, 5, 13, 4, C.w).rect(1, 8, 13, 1, C.W); } },
  /* --- Argent et marché */
  cash: art(["nnnnnnnnnnnnn", "nNNNNNNNNNNNn", "nNnnnnnnnnnNn", "nNnnnlllnnnNn", "nNnnnlllnnnNn", "nNnnnnnnnnnNn", "nNNNNNNNNNNNn", "nnnnnnnnnnnnn"]),
  card: art(["uuuuuuuuuuuuu", "uuuuuuuuuuuuu", "kkkkkkkkkkkkk", "uuuuuuuuuuuuu", "uyyuuuuuuuuuu", "uyyuuuuuuuuuu", "uuuuuuuuuuuuu", "uwwwuwwwuwwuu", "uuuuuuuuuuuuu"]),
  goldbar: { w: 13, h: 7, draw: (c) => { c.rows(1, [[4, 9], [3, 10], [3, 10]], C.y).rect(3, 3, 8, 1, C.Y).rows(4, [[1, 11], [0, 12], [0, 12]], C.y).rect(0, 6, 13, 1, C.Y).set(5, 1, "#FFF3B0").set(2, 4, "#FFF3B0"); } },
  piggy: { w: 14, h: 10, draw: (c) => { ellipse(c, 7, 5, 6.5, 4.2, C.p); c.rect(4, 0, 2, 2, C.P).rect(12, 4, 2, 3, C.P).set(13, 5, C.k).set(10, 3, C.k).rect(6, 1, 3, 1, C.k).rect(3, 9, 2, 1, C.P).rect(9, 9, 2, 1, C.P); } },
  chartUp: { w: 13, h: 11, draw: (c) => { c.rect(0, 10, 13, 1, C.K).rect(1, 7, 2, 3, C.n).rect(4, 5, 2, 5, C.n).rect(7, 3, 2, 7, C.n).rect(10, 0, 2, 10, C.l); } },
  chartDown: { w: 13, h: 11, draw: (c) => { c.rect(0, 10, 13, 1, C.K).rect(1, 0, 2, 10, C.r).rect(4, 3, 2, 7, C.r).rect(7, 5, 2, 5, C.R).rect(10, 7, 2, 3, C.R); } },
  candles: { w: 13, h: 12, draw: (c) => { for (const [x, top, len, col] of [[0, 3, 5, C.n], [3, 5, 5, C.r], [6, 2, 5, C.n], [9, 0, 6, C.l]] as [number, number, number, string][]) c.rect(x + 1, top - 1, 1, len + 2, C.K).rect(x, top, 3, len, col); } },
  bull: art(["w...........w", "ww.........ww", ".wwbbbbbbbww.", "..bbbbbbbbb..", "..bkbbbbbkb..", "..bbbbbbbbb..", "...bBBBBBb...", "...BwBBBwB...", "....BBBBB...."]),
  bear: art([".BB.......BB.", "BbbB.....BbbB", ".BbbbbbbbbbB.", "..bbbbbbbbb..", "..bkbbbbbkb..", "..bbbbbbbbb..", "...bWWWWWb...", "...bWWkWWb...", "....bWWWb....", ".....bbb....."]),
  whale: art([".........c.c...", "..........c....", "..CCCCCCCC.....", ".CCCCCCCCCC...C", "CCCkCCCCCCCC.CC", "CCCCCCCCCCCCCC.", "cccccccCCCCCC..", ".ccccccccccc...", "..ccccccc......"]),
  gem: art(["..ccccccc..", ".cwccccCCC.", "cwcccccCCCC", "CCCCCCCCCCC", ".CccccccCC.", "..CcccccC..", "...CcccC...", "....CcC....", ".....C....."]),
  trophy: art(["yyyyyyyyyyy", "Y.yyyyyyy.Y", "Y.ywyyyyy.Y", ".YywyyyyyY.", "..yyyyyyy..", "...yyyyy...", "....yyy....", ".....y.....", ".....y.....", "...YYYYY...", "..YYYYYYY..", "..bbbbbbb.."]),
  rocketUp: art(["....w....", "...www...", "..wwwww..", "..wcwww..", "..wwwww..", "..wwwww..", ".pwwwwwp.", "pp.www.pp", "...o.o...", "...ooo..."]),
  moon: { w: 9, h: 9, draw: (c) => { c.circle(4.5, 4.5, 4.5, C.y); for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x + 0.5 - 6.4) ** 2 + (y + 0.5 - 3.4) ** 2 <= 3.6 ** 2) c.del(x, y); } },
  arrowUp: art(["....l....", "...lll...", "..lllll..", ".lllllll.", "lllllllll", "...lll...", "...lll...", "...lll...", "...lll...", "...LLL..."]),
  arrowDown: art(["...PPP...", "...ppp...", "...ppp...", "...ppp...", "...ppp...", "ppppppppp", ".ppppppp.", "..ppppp..", "...ppp...", "....p...."]),
  lightning: art(["...yyyy", "..yyyy.", "..yyy..", ".yyyyyy", ".yyyyy.", "...yyy.", "..yyy..", "..yy...", ".yy....", ".y....."]),
  /* --- Justice, temps, communication */
  scales: art(["......Y......", "YYYYYYYYYYYYY", "Y.....Y.....Y", "Y.....Y.....Y", "yyy...Y...yyy", ".y....Y....y.", "......Y......", "......Y......", "....YYYYY....", "...YYYYYYY..."]),
  handcuffs: { w: 13, h: 7, draw: (c) => { c.circle(2.5, 3.5, 2.6, C.s).circle(10.5, 3.5, 2.6, C.s); c.del(2, 3).del(10, 3); c.rect(5, 3, 3, 1, C.S); } },
  hourglass: art(["bbbbbbbbb", ".wyyyyyw.", ".wwyyyww.", "..wwyww..", "...wyw...", "....y....", "...wyw...", "..wwyww..", ".wwwywww.", ".wwyyyww.", ".wyyyyyw.", "bbbbbbbbb"]),
  clock: { w: 11, h: 11, draw: (c) => { c.circle(5.5, 5.5, 5.5, C.w).line(5, 5, 5, 2, C.k).line(5, 5, 8, 5, C.k).set(5, 1, C.K).set(9, 5, C.K).set(5, 9, C.K).set(1, 5, C.K); } },
  calendar: art(["rrrrrrrrrrr", "rRrrrrrrrRr", "wwwwwwwwwww", "wkwkwkwkwkw", "wwwwwwwwwww", "wkwkwpppwkw", "wwwwwpppwww", "wkwkwkwkwkw", "wwwwwwwwwww"]),
  mail: art(["wwwwwwwwwwwww", "wWwwwwwwwwwWw", "wwWwwwwwwwWww", "wwwWwwwwwWwww", "wwwwWwwwWwwww", "wwwwwWwWwwwww", "wwwwwwWwwwwww", "wwwwwwwwwwwww", "WWWWWWWWWWWWW"]),
  chat: art(["wwwwwwwwwwwww", "wwwwwwwwwwwww", "wgggggggggwww", "wwwwwwwwwwwww", "wgggggggwwwww", "wwwwwwwwwwwww", "wwwwwwwwwwwww", "..www........", "..ww.........", "..w.........."]),
  megaphone: { w: 13, h: 9, draw: (c) => { for (let x = 3; x < 13; x++) { const h = Math.round(3 + (x - 3) * 0.67); c.rect(x, 4 - Math.floor(h / 2), 1, h, C.p); } c.rect(0, 3, 3, 3, C.K).rect(12, 0, 1, 9, C.P); } },
  flag: { w: 10, h: 13, draw: (c) => { c.rect(0, 0, 1, 13, C.g).rect(1, 1, 8, 5, C.p).rect(1, 5, 8, 1, C.P).set(9, 2, C.p).set(9, 3, C.p); } },
  globe: { w: 11, h: 11, draw: (c) => { c.circle(5.5, 5.5, 5.5, C.C).rect(2, 2, 3, 2, C.n).rect(3, 4, 2, 2, C.n).rect(6, 6, 3, 2, C.n).rect(7, 3, 2, 2, C.n).set(2, 1, C.c).set(1, 2, C.c); } },
  snowflake: { w: 11, h: 11, draw: (c) => { c.line(5, 0, 5, 10, C.c).line(0, 5, 10, 5, C.c).line(1, 1, 9, 9, C.c).line(9, 1, 1, 9, C.c).set(5, 5, C.w); } },
  /* --- Divers */
  star: art([".....y.....", ".....y.....", "....yyy....", "yyyyyyyyyyy", ".yyyyyyyyy.", "..yyyyyyy..", "..yyyyyyy..", ".yyyy.yyyy.", ".yyy...yyy.", "yy.......yy"]),
  heart: art([".pp...pp.", "pwpppppPp", "ppppppppP", "ppppppppP", ".ppppppP.", "..ppppP..", "...ppP...", "....P...."]),
} satisfies Record<string, Drawer>;
