#!/usr/bin/env node
// Generates the Magnetix logo SVGs into brand/:
//   magnetix-logo.svg       wordmark for light backgrounds
//   magnetix-logo-dark.svg  wordmark for dark backgrounds
//   magnetix-icon.svg       the M alone; follows the system light/dark theme (used as the favicon)
//
//   node brand/logo.mjs
//
// Everything is drawn as plain geometry (no font), in units where the letters' cap line is
// y = 20 and the baseline y = 100.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLORS = {
  light: { ink: '#111111', bolt: '#0b4f96' },   // bolt: the deep blue of the app's field lines
  dark:  { ink: '#e8e8e8', bolt: '#3794ff' },
};

const SW = 10, s = SW / 2;         // stroke weight of the letters (and of the M's line)
const T = 20, B = 100;             // cap line, baseline
const GAP = 17;                    // space between letters
const SPLIT = 12;                  // gap between the M's black line and the bolt

// The M: one ribbon running from the bottom of the line, up to the peak, then along the bolt
// to a point below the baseline. [x, y, width] per vertex.
const M = [[-54, 150, 7.5], [0, -20, 12.5], [24, 62, 15], [46, 2, 13.75], [70, 112, 0]];
const MITRE = 4;

const f = v => +v.toFixed(2);
const dir = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], l = Math.hypot(x, y); return [x / l, y / l]; };
// intersection of the lines p + t·d and q + u·e
function meet(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0], t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + t * d[0], p[1] + t * d[1]];
}
const poly = pts => 'M' + pts.map(p => `${f(p[0])},${f(p[1])}`).join(' L') + ' Z';

// edges of a polyline drawn with per-vertex width (mitred corners, width 0 → a point)
function ribbon(pts, w) {
  const n = pts.length, left = [], right = [];
  const nrm = (a, b) => { const d = dir(a, b); return [-d[1], d[0]]; };
  for (let i = 0; i < n; i++) {
    let m;
    if (i === 0) m = nrm(pts[0], pts[1]);
    else if (i === n - 1) m = nrm(pts[n - 2], pts[n - 1]);
    else {
      const a = nrm(pts[i - 1], pts[i]), b = nrm(pts[i], pts[i + 1]);
      let mx = a[0] + b[0], my = a[1] + b[1]; const ml = Math.hypot(mx, my); mx /= ml; my /= ml;
      const k = Math.min(MITRE, 1 / (mx * a[0] + my * a[1])); m = [mx * k, my * k];
    }
    left.push([pts[i][0] + m[0] * w[i] / 2, pts[i][1] + m[1] * w[i] / 2]);
    right.push([pts[i][0] - m[0] * w[i] / 2, pts[i][1] - m[1] * w[i] / 2]);
  }
  return { left, right };
}

// Splits the ribbon into the line and the bolt. The bolt keeps the peak: its edge facing the line
// carries straight on up to the line's outer edge. The line's top is cut parallel to that edge,
// SPLIT units below it.
function mark() {
  const r = ribbon(M.map(p => [p[0], p[1]]), M.map(p => p[2]));
  const [out, inn] = r.left[1][1] < r.right[1][1] ? [r.left, r.right] : [r.right, r.left];
  const dOut = dir(out[0], out[1]), dInn = dir(inn[0], inn[1]), e = dir(inn[1], inn[2]);
  let n = [-e[1], e[0]];
  if ((out[0][0] - inn[1][0]) * n[0] + (out[0][1] - inn[1][1]) * n[1] < 0) n = [-n[0], -n[1]];
  const c = [inn[1][0] + n[0] * SPLIT, inn[1][1] + n[1] * SPLIT];
  const line = [out[0], meet(out[0], dOut, c, e), meet(inn[0], dInn, c, e), inn[0]];
  const bolt = [meet(out[0], dOut, inn[1], e), ...out.slice(1), ...inn.slice(1).reverse()];
  return { line, bolt };
}

// elliptical arc as cubic Béziers (≤ 30° each); angles in degrees, y down
function arc(cx, cy, rx, ry, a0, a1) {
  const n = Math.ceil(Math.abs(a1 - a0) / 30), d = (a1 - a0) / n * Math.PI / 180, k = 4 / 3 * Math.tan(d / 4);
  let out = '', t = a0 * Math.PI / 180;
  for (let i = 0; i < n; i++, t += d) {
    const c0 = Math.cos(t), s0 = Math.sin(t), c1 = Math.cos(t + d), s1 = Math.sin(t + d);
    out += ` C${f(cx + rx * (c0 - k * s0))},${f(cy + ry * (s0 + k * c0))} ${f(cx + rx * (c1 + k * s1))},${f(cy + ry * (s1 - k * c1))} ${f(cx + rx * c1)},${f(cy + ry * s1)}`;
  }
  return out;
}

// Monoline capitals: [width, path(W), round]. Strokes are laid out so their outer edges sit on the
// cap line and baseline; pointed ends are cut flat there by a clip (round letters skip the clip).
const H = B - T;
const LETTERS = {
  A: [62.4, W => { const y = T + .66 * H, x = (B - y) / H * W / 2, ex = SW / H * W / 2;
       return `M${f(-ex)},${B + SW} L${f(W / 2)},${T} L${f(W + ex)},${B + SW} M${f(x)},${f(y)} L${f(W - x)},${f(y)}`; }],
  G: [64, W => { const cx = W / 2, cy = (T + B) / 2, rx = W / 2 - s, ry = H / 2 - s + 1.5, e = 6 * Math.PI / 180, st = -40 * Math.PI / 180;
       return `M${f(cx + rx * Math.cos(st))},${f(cy + ry * Math.sin(st))}` + arc(cx, cy, rx, ry, -40, -354) + ` L${f(W * .52)},${f(cy + ry * Math.sin(e))}`; }, true],
  N: [57.6, W => `M${s},${B} L${s},${T} L${W - s},${B} L${W - s},${T}`],
  E: [44.8, W => `M${W},${T + s} L${s},${T + s} L${s},${B - s} L${W},${B - s} M${s},${(T + B) / 2} L${W - 6},${(T + B) / 2}`],
  T: [52.8, W => `M0,${T + s} L${W},${T + s} M${W / 2},${T + s} L${W / 2},${B}`],
  I: [SW, () => `M${s},${T} L${s},${B}`],
  X: [56, W => { const ex = SW / H * W;
       return `M${f(-ex)},${T - SW} L${f(W + ex)},${B + SW} M${f(W + ex)},${T - SW} L${f(-ex)},${B + SW}`; }],
};
const KERN = { AG: -2.4, ET: -4.8, TI: -3.2 };   // optical spacing

function svg({ ink, bolt }, { icon = false, style = '', id = 'mgx' } = {}) {
  const { line, bolt: b } = mark();
  const all = [...line, ...b], xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  let x = Math.max(...xs) + GAP, clipped = '', round = '';
  if (!icon) for (const [i, ch] of [...'AGNETIX'].entries()) {
    const [w, d, isRound] = LETTERS[ch], p = `<path transform="translate(${f(x)} 0)" d="${d(w)}"/>`;
    if (isRound) round += p; else clipped += p;
    x += w + GAP + (KERN[ch + 'AGNETIX'[i + 1]] || 0);
  }
  const pad = 8, x0 = Math.min(...xs) - pad, x1 = icon ? Math.max(...xs) + pad : x - GAP + pad;
  const y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const fills = style ? ['class="ink"', 'class="bolt"', 'class="ink"'] : [`fill="${ink}"`, `fill="${bolt}"`, `stroke="${ink}"`];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}"${icon ? '' : ' role="img" aria-label="Magnetix"'}>
${style ? `<style>${style}</style>\n` : ''}<path ${fills[0]} d="${poly(line)}"/>
<path ${fills[1]} d="${poly(b)}"/>
${icon ? '' : `<defs><clipPath id="${id}-cap"><rect x="${f(x0)}" y="${T}" width="${f(x1 - x0)}" height="${H}"/></clipPath></defs>
<g fill="none" ${fills[2]} stroke-width="${SW}" stroke-miterlimit="10"><g clip-path="url(#${id}-cap)">${clipped}</g>${round}</g>
`}</svg>
`;
}

export const wordmark = (theme = 'light', opts) => svg(COLORS[theme], opts);
export const icon = (theme = 'light') => svg(COLORS[theme], { icon: true });
// icon that follows the viewer's light/dark setting (for the browser tab)
export const adaptiveIcon = () => svg(COLORS.light, { icon: true, style:
  `.ink{fill:${COLORS.light.ink}}.bolt{fill:${COLORS.light.bolt}}` +
  `@media (prefers-color-scheme:dark){.ink{fill:${COLORS.dark.ink}}.bolt{fill:${COLORS.dark.bolt}}}` });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = dirname(fileURLToPath(import.meta.url));
  const out = { 'magnetix-logo.svg': wordmark('light'), 'magnetix-logo-dark.svg': wordmark('dark'),
    'magnetix-icon.svg': adaptiveIcon(), 'magnetix-icon-dark.svg': icon('dark') };
  for (const [name, text] of Object.entries(out)) writeFileSync(join(dir, name), text);
  console.log('wrote', Object.keys(out).map(n => 'brand/' + n).join(', '));
}
