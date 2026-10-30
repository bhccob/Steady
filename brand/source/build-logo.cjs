// Builds every Steady logo file from one set of measurements: the "steady." wordmark, the "s." symbol,
// lockups, colour versions and the app, notification and web icons. Letters are drawn as filled outlines
// (no strokes, no fonts), so the masters scale, print and convert cleanly.
//
// From the repo root:
//   npm install --no-save @resvg/resvg-js@2.6.2
//   node brand/source/build-logo.cjs [outDir] [assetsDir] [publicDir]   (defaults: brand, assets, public; "-" skips a copy)
const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { Resvg } = require('@resvg/resvg-js');

// ---------- colour ----------
const C = {
  ink: '#1B1613', // Steady Ink: letters
  bronze: '#7F6440', // Mark Bronze: the full stop, the one coloured mark
  beige: '#E8D5B5', // Steady Beige: app tile
  paper: '#F5F3EF', // Paper: light backgrounds
  linen: '#F3ECE2', // Linen: letters on dark
  sand: '#D9C29C', // Sand: the full stop on dark
};

// ---------- geometry ----------
const fmt = (n) => String(+n.toFixed(2));
const pt = (x, y) => ({ x, y });
const P = (p) => `${fmt(p.x)} ${fmt(p.y)}`;
const rad = (d) => (d * Math.PI) / 180;
const polar = (c, r, deg) => pt(c.x + r * Math.cos(rad(deg)), c.y + r * Math.sin(rad(deg)));

// Every outline runs clockwise on screen, holes anticlockwise, so one nonzero-filled path unions them.
// A stroke along an arc from a0 to a1 degrees (clockwise on screen), half-width h, round ends.
function arcStroke(c, r, a0, a1, h) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(c, r + h, a0), o1 = polar(c, r + h, a1), i1 = polar(c, r - h, a1), i0 = polar(c, r - h, a0);
  return `M${P(o0)}A${fmt(r + h)} ${fmt(r + h)} 0 ${large} 1 ${P(o1)}A${fmt(h)} ${fmt(h)} 0 0 1 ${P(i1)}` +
    `A${fmt(r - h)} ${fmt(r - h)} 0 ${large} 0 ${P(i0)}A${fmt(h)} ${fmt(h)} 0 0 1 ${P(o0)}Z`;
}
// A straight stroke with round ends.
function lineStroke(a, b, h) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = pt(-(b.y - a.y) / len, (b.x - a.x) / len);
  const a1 = pt(a.x - n.x * h, a.y - n.y * h), b1 = pt(b.x - n.x * h, b.y - n.y * h);
  const b2 = pt(b.x + n.x * h, b.y + n.y * h), a2 = pt(a.x + n.x * h, a.y + n.y * h);
  return `M${P(a1)}L${P(b1)}A${fmt(h)} ${fmt(h)} 0 0 1 ${P(b2)}L${P(a2)}A${fmt(h)} ${fmt(h)} 0 0 1 ${P(a1)}Z`;
}
// A full ring (the bowls of a and d).
function ring(c, r, h) {
  const R = r + h, q = r - h;
  return `M${P(pt(c.x + R, c.y))}A${fmt(R)} ${fmt(R)} 0 1 1 ${P(pt(c.x - R, c.y))}A${fmt(R)} ${fmt(R)} 0 1 1 ${P(pt(c.x + R, c.y))}Z` +
    `M${P(pt(c.x + q, c.y))}A${fmt(q)} ${fmt(q)} 0 1 0 ${P(pt(c.x - q, c.y))}A${fmt(q)} ${fmt(q)} 0 1 0 ${P(pt(c.x + q, c.y))}Z`;
}
// ---------- cubic curves ----------
const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (a) => Math.hypot(a.x, a.y);
function split(c, t) {
  const [p0, p1, p2, p3] = c;
  const a = lerp(p0, p1, t), b = lerp(p1, p2, t), e = lerp(p2, p3, t), d = lerp(a, b, t), f = lerp(b, e, t), m = lerp(d, f, t);
  return [[p0, a, d, m], [m, f, e, p3]];
}
const cubicAt = (c, t) => split(c, t)[0][3];
// One cubic offset by d along its left normal: ends move along the normal, handles keep their direction
// and scale by (1 - d·k). Accurate on short pieces; offsetChain measures the error.
function offsetCubic([p0, p1, p2, p3], d) {
  const v0 = sub(p1, p0), v1 = sub(p3, p2);
  const k0 = (2 / 3) * cross(v0, sub(p2, p1)) / len(v0) ** 3;
  const k1 = (2 / 3) * cross(sub(p2, p1), v1) / len(v1) ** 3;
  const n0 = pt(-v0.y / len(v0), v0.x / len(v0)), n1 = pt(-v1.y / len(v1), v1.x / len(v1));
  const q0 = pt(p0.x + n0.x * d, p0.y + n0.y * d), q3 = pt(p3.x + n1.x * d, p3.y + n1.y * d);
  const q1 = pt(q0.x + v0.x * (1 - d * k0), q0.y + v0.y * (1 - d * k0));
  const q2 = pt(q3.x - v1.x * (1 - d * k1), q3.y - v1.y * (1 - d * k1));
  return [q0, q1, q2, q3];
}
// Largest gap between |d| and the true distance from an offset to its centreline piece.
function pieceError(c, o, d) {
  const dense = Array.from({ length: 121 }, (_, i) => cubicAt(c, i / 120));
  let worst = 0;
  for (let i = 0; i <= 12; i++) {
    const q = cubicAt(o, i / 12);
    worst = Math.max(worst, Math.abs(Math.min(...dense.map((p) => len(sub(p, q)))) - Math.abs(d)));
  }
  return worst;
}
// Offset each curve, halving any piece whose offset strays more than tol (in logo units) from true.
function offsetAdaptive(c, d, tol = 0.02, depth = 0) {
  const o = offsetCubic(c, d);
  if (depth >= 6 || pieceError(c, o, d) <= tol) return [o];
  const [a, b] = split(c, 0.5);
  return [...offsetAdaptive(a, d, tol, depth + 1), ...offsetAdaptive(b, d, tol, depth + 1)];
}
const offsetChain = (curves, d) => curves.flatMap((c) => offsetAdaptive(c, d));
// Largest gap between |d| and the true distance from the whole offset chain to the centreline.
function offsetError(curves, d) {
  const dense = curves.flatMap((c) => Array.from({ length: 401 }, (_, i) => cubicAt(c, i / 400)));
  let worst = 0;
  for (const o of offsetChain(curves, d)) {
    for (let i = 0; i <= 20; i++) {
      const q = cubicAt(o, i / 20);
      const dist = Math.min(...dense.map((p) => len(sub(p, q))));
      worst = Math.max(worst, Math.abs(dist - Math.abs(d)));
    }
  }
  return worst;
}
// Tightest bend along the centreline (it must stay wider than the half-stroke, or the inside edge folds).
function minRadius(curves) {
  let r = Infinity;
  for (const c of curves) {
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, m = 1 - t;
      const [p0, p1, p2, p3] = c;
      const d1 = pt(3 * (m * m * (p1.x - p0.x) + 2 * m * t * (p2.x - p1.x) + t * t * (p3.x - p2.x)), 3 * (m * m * (p1.y - p0.y) + 2 * m * t * (p2.y - p1.y) + t * t * (p3.y - p2.y)));
      const d2 = pt(6 * (m * (p2.x - 2 * p1.x + p0.x) + t * (p3.x - 2 * p2.x + p1.x)), 6 * (m * (p2.y - 2 * p1.y + p0.y) + t * (p3.y - 2 * p2.y + p1.y)));
      const k = Math.abs(cross(d1, d2)) / len(d1) ** 3;
      if (k > 0) r = Math.min(r, 1 / k);
    }
  }
  return r;
}
// An elliptical arc as cubics (one per quarter or less), from angle a0 to a1 in degrees.
function ellArc(c, rx, ry, a0, a1) {
  const n = Math.ceil(Math.abs(a1 - a0) / 90), step = (a1 - a0) / n, out = [];
  for (let i = 0; i < n; i++) {
    const t0 = rad(a0 + step * i), t1 = rad(a0 + step * (i + 1)), k = (4 / 3) * Math.tan((t1 - t0) / 4);
    const e = (t) => pt(c.x + rx * Math.cos(t), c.y + ry * Math.sin(t));
    const de = (t) => pt(-rx * Math.sin(t), ry * Math.cos(t));
    const p0 = e(t0), p3 = e(t1);
    out.push([p0, pt(p0.x + k * de(t0).x, p0.y + k * de(t0).y), pt(p3.x - k * de(t1).x, p3.y - k * de(t1).y), p3]);
  }
  return out;
}
// A smooth chain of cubics, stroked with round ends.
function curveStroke(curves, h) {
  const right = offsetChain(curves, -h), left = offsetChain(curves, h);
  const C3 = (c) => `C${P(c[1])} ${P(c[2])} ${P(c[3])}`;
  const start = right[0][0], lEnd = left.at(-1)[3];
  return `M${P(start)}${right.map(C3).join('')}A${fmt(h)} ${fmt(h)} 0 0 1 ${P(lEnd)}` +
    `${[...left].reverse().map((c) => C3([...c].reverse())).join('')}A${fmt(h)} ${fmt(h)} 0 0 1 ${P(start)}Z`;
}
function roundRect(x, y, w, h, r) {
  return `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}` +
    `V${fmt(y + h - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)}H${fmt(x + r)}` +
    `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + h - r)}V${fmt(y + r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + r)} ${fmt(y)}Z`;
}

// ---------- the letters ----------
// Wordmark units: stroke 18, x-height centreline 94-162 (outer 85-171), baseline outer 171.
const W = 18;
const X_TOP = 94, X_BOT = 162;

// The s: two elliptical bowls joined by a spine. The bottom bowl is a touch bigger than the top one, and
// both reach the round letters' height. Bends stay wider than the half-stroke so the inside edge never folds.
function sCurves({ left = 23, width = 47, top = X_TOP + 0.5, bottom = X_BOT - 0.5, spine = 20, termTop = -28, termBot = 150 } = {}) {
  const mid = (top + bottom) / 2;
  const rxT = (width - 1) / 2, rxB = width / 2; // top bowl 1 unit narrower
  const ryT = (mid - top) / 2 - 0.25, ryB = (bottom - mid) / 2 + 0.25; // top bowl half a unit shorter
  const cT = pt(left + rxT, top + ryT), cB = pt(left + width - rxB, bottom - ryB);
  const a = ellArc(cT, rxT, ryT, termTop, -180); // terminal, over the top, down the left side
  const p0 = pt(left, cT.y), p3 = pt(left + width, cB.y);
  const s = [p0, pt(p0.x, p0.y + spine), pt(p3.x, p3.y - spine), p3]; // the spine
  const b = ellArc(cB, rxB, ryB, 0, termBot); // down the right side, under, up to the terminal
  return [...a, s, ...b];
}

const PERIOD = 22; // the full stop: a little heavier than the stroke, so it reads as a block

function wordmarkParts(w = W) {
  const h = w / 2;
  // Optical spacing: straight next to round gets 14 units, round next to round 10, a diagonal 9 at its closest.
  const sh = { s: 0, t: 0, e: 0, a: -4, d: -6, y: -9 };
  const L = (x, y) => (k) => pt(x + sh[k], y);
  // The y's long arm runs from (524, 94) down-left at 120:48; its tail stops 39 units under the baseline,
  // in step with the d's ascender.
  const armAt = (y) => pt(524 + sh.y - (48 * (y - 94)) / 120, y);
  const letters = {
    s: curveStroke(sCurves().map((c) => c.map((p) => pt(p.x + sh.s, p.y))), h),
    t: lineStroke(L(116, 70)('t'), L(116, 146)('t'), h) + arcStroke(pt(132 + sh.t, 146), 16, 90, 180, h) +
      lineStroke(L(100, 94)('t'), L(134, 94)('t'), h),
    e: lineStroke(L(166, 128)('e'), L(234, 128)('e'), h) + arcStroke(pt(200 + sh.e, 128), 34, 40, 360, h),
    a: ring(pt(300 + sh.a, 128), 34, h) + lineStroke(L(334, 94)('a'), L(334, 162)('a'), h),
    d: ring(pt(402 + sh.d, 128), 34, h) + lineStroke(L(436, 58)('d'), L(436, 162)('d'), h),
    y: lineStroke(L(466, 94)('y'), armAt(160), h) + lineStroke(armAt(94), armAt(201), h),
  };
  // Tuck the full stop in under the y's arm: its rounded top corner sits 7 units clear of the arm's edge.
  const top = X_BOT + h - PERIOD;
  const edge = armAt(top).x + (h * 129.24) / 120; // the arm's right edge, measured across
  const dot = roundRect(edge + 7, top, PERIOD, PERIOD, 6);
  return { letters: Object.values(letters).join(''), dot };
}

// The "s." symbol: the wordmark's own s and full stop, set close.
function symbolParts({ w = W, period = PERIOD, gap = 10, widen = 0 } = {}) {
  const h = w / 2;
  const curves = sCurves({ width: 47 + widen, top: X_TOP + 0.5 - (w - W) / 2, bottom: X_BOT - 0.5 + (w - W) / 2 });
  const s = curveStroke(curves, h);
  const sRight = 23 + 47 + widen + h;
  const base = X_BOT + W / 2 + (w - W) / 2;
  const dot = roundRect(sRight + gap, base - period, period, period, period * 0.27);
  return { letters: s, dot };
}

// ---------- SVG + raster helpers ----------
const svgDoc = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><title>${title}</title>${body}</svg>\n`;
const fill = (d, color) => `<path fill="${color}" d="${d}"/>`;

function bbox(body, vb = '0 0 1000 1000') {
  const r = new Resvg(svgDoc(vb, body, 'b'));
  const b = r.getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}
function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render().asPng();
}
// Where the ink sits, as opposed to the box: the s carries the weight, the full stop very little.
function inkCentre(body, b) {
  const img = new Resvg(svgDoc(`${b.x} ${b.y} ${b.w} ${b.h}`, body, 'c'), { fitTo: { mode: 'width', value: 300 } }).render();
  const px = img.pixels, w = img.width, h = img.height;
  let sx = 0, sy = 0, sa = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = px[(y * w + x) * 4 + 3]; sx += a * x; sy += a * y; sa += a; }
  return pt(b.x + ((sx / sa + 0.5) / w) * b.w, b.y + ((sy / sa + 0.5) / h) * b.h);
}
// Scales a body to `fit` of a size×size square's width and centres it optically: across, halfway between
// its box and its ink; down, on its box, nudged up 1%.
function place(body, size, fit) {
  const b = bbox(body), c = inkCentre(body, b);
  const k = (fit * size) / b.w;
  const cx = (b.x + b.w / 2 + c.x) / 2, cy = b.y + b.h / 2;
  return `<g transform="translate(${fmt(size / 2 - cx * k)} ${fmt(size / 2 - cy * k - size * 0.01)}) scale(${+k.toFixed(5)})">${body}</g>`;
}
// The width share that keeps a body's box corners within `radius` (share of the canvas) of the centre:
// Android's adaptive-icon and maskable safe zones are circles.
function fitInCircle(body, radius) {
  const b = bbox(body);
  return (2 * radius * b.w) / Math.hypot(b.w, b.h);
}
function tight(body, title) {
  const b = bbox(body);
  const x = Math.floor(b.x + 1e-3), y = Math.floor(b.y + 1e-3), w = Math.ceil(b.x + b.w - 1e-3) - x, h = Math.ceil(b.y + b.h - 1e-3) - y;
  return svgDoc(`${x} ${y} ${w} ${h}`, body, title);
}
// favicon.ico holding PNG images.
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

// ---------- the parts ----------
const body = (parts, ink, dot) => fill(parts.letters, ink) + fill(parts.dot, dot);
const parts = {
  wordmark: wordmarkParts(),
  wordmarkThin: wordmarkParts(W - 1), // light on dark looks heavier, so reversed versions lose a unit
  symbol: symbolParts(),
  symbolThin: symbolParts({ w: W - 1 }),
  // For 48 px and under: heavier stroke, wider s, bigger and further-out full stop.
  symbolSmall: symbolParts({ w: 22, widen: 6, period: 26, gap: 12 }),
};
const COLOURWAYS = {
  colour: { ink: C.ink, dot: C.bronze, thin: false }, // on Paper, white or Beige
  reversed: { ink: C.linen, dot: C.sand, thin: true }, // on Ink or any dark ground
  black: { ink: '#000000', dot: '#000000', thin: false },
  white: { ink: '#FFFFFF', dot: '#FFFFFF', thin: true },
};
const TILE_RADIUS = 0.225; // corner radius of the app tile, as a share of its size
const TILE_FIT = 0.6; // the symbol's width on its tile
const tile = (size, symbolBody, { bg = C.beige, radius = TILE_RADIUS, fit = TILE_FIT } = {}) =>
  `<rect width="${size}" height="${size}" rx="${fmt(size * radius)}" fill="${bg}"/>` + place(symbolBody, size, fit);

// Lockups, in wordmark units. Horizontal: a tile 1.5 x-heights tall, centred on the x-height, 0.45 x-height
// away from the letters. Stacked: a 200-unit tile centred over the letters (the full stop hangs outside).
const XH = X_BOT - X_TOP + W; // x-height, outer
function horizontal(wm, sym) {
  const t = Math.round(XH * 1.5), gap = Math.round(XH * 0.45), b = bbox(wm);
  return `<g transform="translate(0 ${fmt(128 - t / 2)})">${tile(t, sym)}</g>` +
    `<g transform="translate(${fmt(t + gap - b.x)} 0)">${wm}</g>`;
}
function stacked(wm, sym, lettersOnly) {
  const t = 200, gap = 44, b = bbox(lettersOnly);
  return `<g transform="translate(${fmt(b.x + b.w / 2 - t / 2)} 0)">${tile(t, sym)}</g>` +
    `<g transform="translate(0 ${fmt(t + gap - 49)})">${wm}</g>`;
}

// ---------- build ----------
function build(outDir, assetsDir, publicDir) {
  const files = {};
  const put = (rel, data) => { files[rel] = data; };

  for (const [name, cw] of Object.entries(COLOURWAYS)) {
    const wm = cw.thin ? parts.wordmarkThin : parts.wordmark;
    const sym = cw.thin ? parts.symbolThin : parts.symbol;
    const sfx = name === 'colour' ? '' : `-${name}`;
    put(`logo/steady-wordmark${sfx}.svg`, tight(body(wm, cw.ink, cw.dot), 'Steady'));
    put(`logo/steady-symbol${sfx}.svg`, tight(body(sym, cw.ink, cw.dot), 'Steady'));
    put(`logo/steady-symbol-small${sfx}.svg`, tight(body(parts.symbolSmall, cw.ink, cw.dot), 'Steady'));
  }
  // Lockups keep the app tile (Beige, with the colour symbol) on both light and dark grounds.
  const symOnTile = body(parts.symbol, C.ink, C.bronze);
  for (const [name, cw] of [['', COLOURWAYS.colour], ['-reversed', COLOURWAYS.reversed]]) {
    const wmParts = cw.thin ? parts.wordmarkThin : parts.wordmark;
    const wm = body(wmParts, cw.ink, cw.dot);
    put(`logo/steady-horizontal${name}.svg`, tight(horizontal(wm, symOnTile), 'Steady'));
    put(`logo/steady-stacked${name}.svg`, tight(stacked(wm, symOnTile, fill(wmParts.letters, cw.ink)), 'Steady'));
  }
  put('logo/steady-app-icon.svg', svgDoc('0 0 1024 1024', tile(1024, symOnTile), 'Steady'));

  // PNG copies of the logo files for documents and slides.
  for (const rel of Object.keys(files)) {
    const base = path.basename(rel, '.svg');
    const widths = base.includes('app-icon') ? [512, 1024] : base.startsWith('steady-symbol') ? [256, 1024] : [1200, 2400];
    for (const w of widths) put(`png/${base}-${w}.png`, png(files[rel], w));
  }

  // App icons.
  const small = body(parts.symbolSmall, C.ink, C.bronze);
  const square = (size, sym, fit) =>
    svgDoc(`0 0 ${size} ${size}`, `<rect width="${size}" height="${size}" fill="${C.beige}"/>` + place(sym, size, fit), 'Steady');
  const adaptiveFit = fitInCircle(symOnTile, 0.26); // same visual size as the iOS icon, well inside the 0.305 safe circle
  const app = {
    'icon-1024.png': png(square(1024, symOnTile, 0.58), 1024), // iOS and Expo; the system rounds the corners
    'play-store-512.png': png(square(512, symOnTile, 0.58), 512),
    // Android adaptive icon: the system crops to a shape within 72 of 108 dp; keep within the 66 dp circle.
    'adaptive-foreground-1024.png': png(svgDoc('0 0 1024 1024', place(symOnTile, 1024, adaptiveFit), 'Steady'), 1024),
    'adaptive-monochrome-1024.png': png(svgDoc('0 0 1024 1024', place(body(parts.symbol, C.ink, C.ink), 1024, adaptiveFit), 'Steady'), 1024),
    // Android status bar: white on clear, 24 dp with 1 dp of padding (96 px at xxxhdpi).
    'notification-96.png': png(svgDoc('0 0 96 96', place(body(parts.symbolSmall, '#FFFFFF', '#FFFFFF'), 96, 0.88), 'Steady'), 96),
  };
  for (const [f, data] of Object.entries(app)) put(`icons/app/${f}`, data);

  // Web icons.
  const favSvg = svgDoc('0 0 64 64', tile(64, small, { radius: 0.2, fit: 0.76 }), 'Steady');
  const fav = [16, 32, 48].map((size) => ({ size, data: png(favSvg, size) }));
  fav.forEach(({ size, data }) => put(`icons/web/favicon-${size}.png`, data));
  put('icons/web/favicon.ico', ico(fav));
  put('icons/web/favicon.svg', favSvg);
  const rounded = svgDoc('0 0 512 512', tile(512, symOnTile, { fit: 0.58 }), 'Steady');
  put('icons/web/apple-touch-icon.png', png(square(180, symOnTile, 0.58), 180));
  put('icons/web/icon-192.png', png(rounded, 192));
  put('icons/web/icon-512.png', png(rounded, 512));
  put('icons/web/maskable-512.png', png(svgDoc('0 0 512 512', `<rect width="512" height="512" fill="${C.beige}"/>` +
    place(symOnTile, 512, fitInCircle(symOnTile, 0.36)), 'Steady'), 512));
  // The web app's manifest: added to a Home Screen, Steady opens full screen, straight into the app.
  put('icons/web/site.webmanifest', JSON.stringify({
    id: '/', name: 'Steady', short_name: 'Steady', start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: C.paper, background_color: C.paper,
  }, null, 2) + '\n');
  put('icons/web/head-snippet.html', '<link rel="icon" href="/favicon.ico" sizes="48x48">\n' +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' +
    `<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${C.paper}">\n`);

  for (const [rel, data] of Object.entries(files)) {
    const p = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  }
  // The app's own copies (app.json points here).
  if (assetsDir) {
    const copy = {
      'icon.png': 'icons/app/icon-1024.png',
      'adaptive-icon.png': 'icons/app/adaptive-foreground-1024.png',
      'adaptive-icon-monochrome.png': 'icons/app/adaptive-monochrome-1024.png',
      'notification-icon.png': 'icons/app/notification-96.png',
      'favicon.png': 'icons/web/favicon-48.png',
    };
    fs.mkdirSync(assetsDir, { recursive: true });
    for (const [to, from] of Object.entries(copy)) fs.writeFileSync(path.join(assetsDir, to), files[from]);
  }
  // The web app's own copies, served from its root (Expo copies public/ into the web build).
  if (publicDir) {
    const web = ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'maskable-512.png'];
    fs.mkdirSync(publicDir, { recursive: true });
    for (const name of web) fs.writeFileSync(path.join(publicDir, name), files[`icons/web/${name}`]);
    fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), files['icons/web/site.webmanifest']);
  }
  return Object.keys(files);
}

module.exports = { C, W, PERIOD, XH, parts, body, wordmarkParts, symbolParts, sCurves, curveStroke, svgDoc, fill, bbox, png, place, tile, tight, offsetError, minRadius, build };

if (require.main === module) {
  const out = process.argv[2] || 'brand';
  const assets = process.argv[3] || 'assets';
  const pub = process.argv[4] || 'public';
  const written = build(out, assets === '-' ? null : assets, pub === '-' ? null : pub);
  console.log(`wrote ${written.length} files to ${out}, the app icons to ${assets} and the web icons to ${pub}`);
}
