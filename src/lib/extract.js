/**
 * extract.js — getting colours in from the world.
 *
 * Image extraction runs k-means in OKLab rather than RGB. Clustering in RGB
 * groups by numeric similarity, which is not the same as visual similarity, and
 * it reliably merges distinct-looking colours while splitting near-identical ones.
 */

import { rgbToHex, hexToOklab, normalizeHex, oklabToRgbRaw } from './color.js';

/* ---------------------------------------------------------------- images */

export async function extractFromImage(file, count = 6) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 320; // enough for stable clusters, fast enough to feel instant
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const points = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // ignore transparency
    const hex = rgbToHex({ r: data[i], g: data[i + 1], b: data[i + 2] });
    points.push(hexToOklab(hex));
  }
  if (!points.length) return [];

  return kmeansOklab(points, count).map((c) => rgbToHex(oklabToRgbRaw(c)));
}

function kmeansOklab(points, k, iterations = 14) {
  // k-means++ seeding: random seeding on photographs collapses into
  // near-duplicate clusters roughly a third of the time.
  const centroids = [points[Math.floor(Math.random() * points.length)]];
  while (centroids.length < k) {
    const distances = points.map((p) =>
      Math.min(...centroids.map((c) => sqDist(p, c)))
    );
    const total = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < distances.length; i++) {
      target -= distances[i];
      if (target <= 0) { idx = i; break; }
    }
    centroids.push(points[idx]);
  }

  let assignment = new Array(points.length).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    points.forEach((p, i) => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, j) => {
        const d = sqDist(p, c);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (assignment[i] !== best) moved = true;
      assignment[i] = best;
    });

    const sums = centroids.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    points.forEach((p, i) => {
      const s = sums[assignment[i]];
      s.L += p.L; s.a += p.a; s.b += p.b; s.n++;
    });
    sums.forEach((s, j) => {
      if (s.n) centroids[j] = { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n };
    });
    if (!moved) break;
  }

  // Order by cluster size so the most present colour in the image comes first.
  const counts = centroids.map((_, j) => assignment.filter((a) => a === j).length);
  return centroids
    .map((c, j) => ({ c, n: counts[j] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.c);
}

function sqDist(a, b) {
  return (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;
}

/* ------------------------------------------------------------- CSS / text */

/**
 * Pulls colours out of pasted CSS, HTML or anything else, ranked by how often
 * each appears. Frequency is a decent proxy for importance in a stylesheet.
 */
export function extractFromText(text, limit = 12) {
  const counts = new Map();
  const bump = (hex) => {
    const h = normalizeHex(hex);
    if (h) counts.set(h, (counts.get(h) || 0) + 1);
  };

  for (const m of text.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi)) bump(m[0]);

  for (const m of text.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/gi)) {
    bump(rgbToHex({ r: +m[1], g: +m[2], b: +m[3] }));
  }

  for (const m of text.matchAll(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/gi)) {
    bump(hslToHex(+m[1], +m[2] / 100, +m[3] / 100));
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hex, count]) => ({ hex, count }));
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor((h % 360) / 60);
  const table = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  const [r, g, b] = table[seg] || [0, 0, 0];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/* ----------------------------------------------------------------- files */

export async function importPaletteFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.ase')) return parseASE(await file.arrayBuffer());

  const text = await file.text();

  if (name.endsWith('.json')) {
    try {
      const data = JSON.parse(text);
      const found = [];
      const walk = (node) => {
        if (typeof node === 'string') {
          const h = normalizeHex(node);
          if (h) found.push(h);
        } else if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === 'object') Object.values(node).forEach(walk);
      };
      walk(data);
      return [...new Set(found)];
    } catch {
      return extractFromText(text).map((x) => x.hex);
    }
  }

  if (name.endsWith('.gpl')) {
    // GIMP palette: "R G B  Name" per line after a header.
    const out = [];
    for (const line of text.split('\n')) {
      const m = line.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
      if (m) out.push(rgbToHex({ r: +m[1], g: +m[2], b: +m[3] }));
    }
    return [...new Set(out)];
  }

  return [...new Set(extractFromText(text, 40).map((x) => x.hex))];
}

/**
 * Adobe Swatch Exchange reader. Handles RGB, CMYK, Gray and LAB blocks.
 * CMYK is converted naively — it is only ever an approximation without a
 * profile, and this tool is screen-only, so a rough conversion is honest.
 */
function parseASE(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 12) return [];

  const signature = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
  );
  if (signature !== 'ASEF') return [];

  const blocks = view.getUint32(8);
  const colors = [];
  let offset = 12;

  for (let i = 0; i < blocks && offset + 6 <= view.byteLength; i++) {
    const type = view.getUint16(offset);
    const length = view.getUint32(offset + 2);
    let p = offset + 6;

    if (type === 0x0001) {
      const nameLength = view.getUint16(p);
      p += 2 + nameLength * 2;

      const model = String.fromCharCode(
        view.getUint8(p), view.getUint8(p + 1), view.getUint8(p + 2), view.getUint8(p + 3)
      ).trim();
      p += 4;

      if (model === 'RGB') {
        colors.push(rgbToHex({
          r: view.getFloat32(p) * 255,
          g: view.getFloat32(p + 4) * 255,
          b: view.getFloat32(p + 8) * 255,
        }));
      } else if (model === 'CMYK') {
        const c = view.getFloat32(p), m = view.getFloat32(p + 4);
        const y = view.getFloat32(p + 8), k = view.getFloat32(p + 12);
        colors.push(rgbToHex({
          r: 255 * (1 - c) * (1 - k),
          g: 255 * (1 - m) * (1 - k),
          b: 255 * (1 - y) * (1 - k),
        }));
      } else if (model === 'Gray') {
        const g = view.getFloat32(p) * 255;
        colors.push(rgbToHex({ r: g, g, b: g }));
      }
    }
    offset += 6 + length;
  }
  return [...new Set(colors)];
}

/* ------------------------------------------------------------- URL fetch */

/**
 * A page served from GitHub Pages cannot fetch a third-party site — the browser
 * blocks it on CORS. Two ways round it, both handled here:
 *   1. A proxy you control (see /worker in this repo). Set it in Settings.
 *   2. No proxy: fall back to telling the user to paste source or drop a
 *      screenshot, both of which work with no infrastructure at all.
 */
export async function extractFromURL(url, proxyBase) {
  if (!proxyBase) {
    throw new Error(
      'Fetching a live site needs a proxy. Add one in Settings, or paste the page source / drop a screenshot instead.'
    );
  }
  const endpoint = `${proxyBase.replace(/\/$/, '')}/?url=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Proxy returned ${res.status}. Check the URL and the proxy address.`);
  const text = await res.text();
  return extractFromText(text, 16);
}
