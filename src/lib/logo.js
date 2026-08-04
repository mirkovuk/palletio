/**
 * logo.js — marks for testing a palette on an identity.
 *
 * A palette can pass every contrast check and still produce a mark that
 * dissolves at 16px, or a one-colour reduction that loses its structure.
 * Neither shows up in a pairing table, because a pairing table tests type.
 *
 * Two sources of mark:
 *   1. Built-in abstract forms, for playing with before a logo exists.
 *   2. An uploaded SVG, recoloured per fill — which is the real use, because
 *      the question is almost always "does this palette work on *this* logo".
 */

/* ------------------------------------------------------------ built-ins */

/**
 * Marks are described as data rather than JSX so this file stays free of React
 * — same rule as the rest of lib/. The component walks `shapes` and renders
 * each one; `slot` says which of the two fill colours it takes.
 *
 * Two slots, `a` (dominant form) and `b` (secondary). A one-colour reduction
 * sets both to the same value, which is exactly the test: if the mark
 * disappears when a === b, it was relying on colour to do a job that form
 * should be doing.
 */
export const MARKS = [
  {
    id: 'arc',
    label: 'Arc',
    note: 'Overlapping curves — tests how two colours read where they meet',
    viewBox: '0 0 64 64',
    shapes: [
      { type: 'path', slot: 'a', d: 'M32 4a28 28 0 0 1 0 56Z' },
      { type: 'path', slot: 'b', d: 'M32 4a28 28 0 0 0 0 56Z' },
      { type: 'circle', slot: 'a', cx: 32, cy: 32, r: 9 },
    ],
  },
  {
    id: 'stack',
    label: 'Stack',
    note: 'Hard geometry — survives small sizes, punishes low contrast',
    viewBox: '0 0 64 64',
    shapes: [
      { type: 'rect', slot: 'a', x: 6, y: 6, width: 24, height: 24, rx: 2 },
      { type: 'rect', slot: 'b', x: 34, y: 6, width: 24, height: 24, rx: 2 },
      { type: 'rect', slot: 'b', x: 6, y: 34, width: 24, height: 24, rx: 2 },
      { type: 'rect', slot: 'a', x: 34, y: 34, width: 24, height: 24, rx: 12 },
    ],
  },
  {
    id: 'counter',
    label: 'Counter',
    note: 'Fine detail and enclosed space — the hardest test at small sizes',
    viewBox: '0 0 64 64',
    shapes: [
      { type: 'circle', slot: 'a', cx: 32, cy: 32, r: 28 },
      { type: 'path', slot: 'b', d: 'M32 14a18 18 0 1 0 0 36 18 18 0 0 0 0-36Zm0 8a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z' },
      { type: 'rect', slot: 'b', x: 29, y: 2, width: 6, height: 16 },
    ],
  },
];

export function getMark(id) {
  return MARKS.find((m) => m.id === id) || MARKS[0];
}

/* -------------------------------------------------------- uploaded SVG */

const DANGEROUS_TAGS = /<\s*(script|foreignObject|iframe|object|embed|link|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSING_DANGEROUS = /<\s*(script|foreignObject|iframe|object|embed|link)\b[^>]*\/?>/gi;
const EVENT_HANDLERS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const EXTERNAL_REFS = /(href|xlink:href)\s*=\s*("|')\s*(?!#)[^"']*\2/gi;

/**
 * An uploaded SVG is untrusted markup that will be injected into the page.
 * Strip anything that can execute or phone home before it goes near the DOM.
 */
export function sanitizeSVG(source) {
  let svg = String(source)
    .replace(DANGEROUS_TAGS, '')
    .replace(SELF_CLOSING_DANGEROUS, '')
    .replace(EVENT_HANDLERS, '')
    .replace(EXTERNAL_REFS, '')
    .replace(/javascript:/gi, '');

  const match = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) throw new Error('That file does not contain an SVG.');
  return match[0];
}

export function readViewBox(svg) {
  const explicit = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (explicit) return explicit[1].trim();

  const width = svg.match(/\swidth\s*=\s*["']([\d.]+)/i);
  const height = svg.match(/\sheight\s*=\s*["']([\d.]+)/i);
  if (width && height) return `0 0 ${width[1]} ${height[1]}`;
  return '0 0 64 64';
}

/** Strips the outer <svg> wrapper so the contents can be re-wrapped at any size. */
export function innerSVG(svg) {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

const NAMED = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', grey: '#808080', gray: '#808080',
};

function normalizeFill(raw) {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'none' || value === 'transparent' || value === 'currentcolor') return null;
  if (value.startsWith('url(')) return null;
  if (NAMED[value]) return NAMED[value];
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) return '#' + hex.split('').map((c) => c + c).join('');
    if (hex.length === 6 || hex.length === 8) return '#' + hex.slice(0, 6);
    return null;
  }
  const rgb = value.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) {
    const to = (n) => Math.round(+n).toString(16).padStart(2, '0');
    return '#' + to(rgb[1]) + to(rgb[2]) + to(rgb[3]);
  }
  return null;
}

/**
 * Every distinct fill in the file, most-used first. These become the slots the
 * user maps onto palette colours.
 */
export function findFills(svg) {
  const counts = new Map();

  for (const m of svg.matchAll(/\sfill\s*=\s*["']([^"']+)["']/gi)) {
    const hex = normalizeFill(m[1]);
    if (hex) counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  for (const m of svg.matchAll(/fill\s*:\s*([^;"'}]+)/gi)) {
    const hex = normalizeFill(m[1]);
    if (hex) counts.set(hex, (counts.get(hex) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

/**
 * Applies a fill mapping. `mapping` is { originalHex: newHex }; anything
 * unmapped is left alone. If `flatten` is set, every fill becomes that one
 * colour — the one-colour reduction.
 */
export function recolorSVG(svg, mapping, flatten = null) {
  const resolve = (raw) => {
    const hex = normalizeFill(raw);
    if (!hex) return null;
    if (flatten) return flatten;
    return mapping[hex] || null;
  };

  let out = svg.replace(/(\sfill\s*=\s*)["']([^"']+)["']/gi, (full, prefix, value) => {
    const next = resolve(value);
    return next ? `${prefix}"${next}"` : full;
  });

  out = out.replace(/(fill\s*:\s*)([^;"'}]+)/gi, (full, prefix, value) => {
    const next = resolve(value);
    return next ? `${prefix}${next}` : full;
  });

  // A mark with no fills at all (stroke-only, or relying on default black)
  // needs a fill applied to the root, or it renders invisible on dark grounds.
  if (flatten && !/fill\s*[:=]/i.test(svg)) {
    out = out.replace(/<svg([^>]*)>/i, `<svg$1 fill="${flatten}">`);
  }

  return out;
}

/* ------------------------------------------------------------ guidance */

/**
 * WCAG 1.4.3 explicitly exempts logotypes — a brand mark has no contrast
 * requirement in law. That does not make contrast irrelevant to it: below
 * about 3:1 a mark stops holding its shape at small sizes and in poor light,
 * which is a legibility problem rather than a compliance one.
 */
export function markGuidance(ratio) {
  if (ratio >= 4.5) return { label: 'Holds at any size', tone: 'good' };
  if (ratio >= 3) return { label: 'Fine above ~32px', tone: 'good' };
  if (ratio >= 2) return { label: 'Large only', tone: 'warn' };
  if (ratio >= 1.3) return { label: 'Barely separates', tone: 'bad' };
  return { label: 'Effectively invisible', tone: 'bad' };
}

export const TEST_SIZES = [
  { px: 96, label: '96px', note: 'Header lockup' },
  { px: 48, label: '48px', note: 'App icon' },
  { px: 32, label: '32px', note: 'Nav mark' },
  { px: 16, label: '16px', note: 'Favicon' },
];
