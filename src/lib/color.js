/**
 * color.js — perceptual colour engine.
 *
 * Everything downstream (harmony, suggestions, contrast, previews) speaks OKLCH.
 * Nothing in this file knows about React, the DOM, or styling.
 *
 * Why OKLCH and not HSL: HSL's "lightness" is not perceptual. #FFFF00 and #0000FF
 * are both L=50% in HSL, but one is blinding and one is nearly black. Every
 * "too dark / too vibrant" judgement built on HSL is therefore wrong for at
 * least half the hue wheel. OKLab fixes this.
 */

/* ---------------------------------------------------------------- parsing */

export function normalizeHex(input) {
  if (typeof input !== 'string') return null;
  let h = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{8}$/i.test(h)) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return '#' + h.toUpperCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/* ------------------------------------------------------- sRGB <-> linear */

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return c * 255;
}

/* ------------------------------------------------------------ OKLab core */

export function hexToOklab(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgbRaw({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/* ------------------------------------------------------------ OKLCH form */

export function hexToOklch(hex) {
  const lab = hexToOklab(hex);
  if (!lab) return null;
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h: C < 0.0005 ? 0 : h };
}

export function oklchToOklab({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return { L, a: Math.cos(rad) * C, b: Math.sin(rad) * C };
}

function inGamut({ r, g, b }, eps = 0.35) {
  return (
    r >= -eps && r <= 255 + eps &&
    g >= -eps && g <= 255 + eps &&
    b >= -eps && b <= 255 + eps
  );
}

/**
 * OKLCH -> hex, reducing chroma until the colour fits in sRGB.
 * Naive clipping shifts hue badly on saturated colours; binary search on C
 * keeps hue and lightness intact, which is what you want when the engine is
 * proposing a "fixed" version of one of the user's brand colours.
 */
export function oklchToHex({ L, C, h }) {
  const Lc = clamp(L, 0, 1);
  let hi = Math.max(0, C);
  if (inGamut(oklabToRgbRaw(oklchToOklab({ L: Lc, C: hi, h })))) {
    return rgbToHex(oklabToRgbRaw(oklchToOklab({ L: Lc, C: hi, h })));
  }
  let lo = 0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToRgbRaw(oklchToOklab({ L: Lc, C: mid, h })))) lo = mid;
    else hi = mid;
  }
  return rgbToHex(oklabToRgbRaw(oklchToOklab({ L: Lc, C: lo, h })));
}

/**
 * Is this OKLCH triplet reachable in sRGB? The picker uses this to draw the
 * gamut boundary, which is the whole reason to build a picker rather than use
 * the system one: sRGB's reachable region in OKLCH is a lopsided shape that
 * differs per hue, and a picker that hides it lets you choose colours that
 * silently clamp to something else.
 *
 * The tolerance here is much tighter than the one `oklchToHex` uses internally.
 * That function needs slack so float error doesn't reject valid colours during
 * its binary search. Boundary drawing needs the opposite: with loose slack,
 * chroma up to roughly 0.11 counts as "reachable" at L=0 even though every one
 * of those values renders as identical black — which would paint a band of
 * phantom colour space along the bottom of the plane that you could drag into
 * and get nothing.
 */
export function isInGamut({ L, C, h }) {
  return inGamut(oklabToRgbRaw(oklchToOklab({ L, C, h })), 0.02);
}

/**
 * Highest chroma sRGB can reach at this lightness and hue.
 *
 * "Reachable" has to mean *distinguishable*, not merely representable. Near
 * black and near white, a range of chroma values are all numerically valid and
 * all quantise to the same 8-bit colour — at L=0 every chroma below about 0.04
 * renders as #000000. Reporting that as available chroma would let the cursor
 * travel into a region where dragging does nothing, and would put a phantom
 * reading in the chroma field. So the boundary is where the output stops
 * changing, which is the boundary a person can actually see.
 */
export function maxChroma(L, h) {
  const achromatic = oklchToHex({ L, C: 0, h });
  const usable = (C) => isInGamut({ L, C, h }) && oklchToHex({ L, C, h }) !== achromatic;

  if (!usable(0.45) && !usable(0.02)) {
    // Nothing at this lightness separates from grey — black and white points.
    let probe = 0.005;
    while (probe < 0.45) {
      if (usable(probe)) break;
      probe *= 1.6;
    }
    if (probe >= 0.45) return 0;
  }

  let lo = 0;
  let hi = 0.45;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut({ L, C: mid, h })) lo = mid;
    else hi = mid;
  }
  return oklchToHex({ L, C: lo, h }) === achromatic ? 0 : lo;
}

/** Widest chroma any hue reaches in sRGB — the picker's x-axis ceiling. */
export const CHROMA_CEILING = 0.37;

/** Perceptual distance. Below ~0.02 two colours are hard to tell apart. */
export function deltaEOK(hexA, hexB) {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  if (!a || !b) return Infinity;
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/** Shortest angular distance between two hues, 0–180. */
export function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

export function rotateHue(hex, degrees) {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, h: (c.h + degrees + 360) % 360 });
}

export function withLightness(hex, L) {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, L: clamp(L, 0, 1) });
}

export function withChroma(hex, C) {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, C: Math.max(0, C) });
}

export function mix(hexA, hexB, t = 0.5) {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  return rgbToHex(
    oklabToRgbRaw({
      L: a.L + (b.L - a.L) * t,
      a: a.a + (b.a - a.a) * t,
      b: a.b + (b.b - a.b) * t,
    })
  );
}

/* ------------------------------------------------------ WCAG 2.1 contrast */

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG pass levels for a given ratio.
 * normalText  — under 18.66px regular / 14pt
 * largeText   — 18.66px+ regular or 14px+ bold
 * uiComponent — borders, icons, focus rings, form outlines (1.4.11)
 */
export function wcagLevels(ratio) {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponent: ratio >= 3,
    aBasic: ratio >= 3,
  };
}

/* ---------------------------------------------------------- APCA (Lc) */

/**
 * APCA-W3 0.1.9. Reported as Lc, roughly -108 to +106.
 * Sign carries meaning: positive is dark text on light background,
 * negative is light text on dark. WCAG 2.x throws that information away,
 * which is why it under-rates light-on-dark pairings.
 */
const APCA = {
  sT: 0.57, sR: 0.62, nT: 0.56, nR: 0.65,
  bT: 0.022, bC: 1.414, sX: 0.001, lF: 0.1,
  sC: 1.14, lO: 0.027, sCd: 1.14, lOd: 0.027,
};

function apcaY(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => Math.pow(c / 255, 2.4);
  return 0.2126729 * f(r) + 0.7151522 * f(g) + 0.072175 * f(b);
}

function softClamp(y) {
  return y < APCA.bT ? y + Math.pow(APCA.bT - y, APCA.bC) : y;
}

export function apcaContrast(textHex, bgHex) {
  const txtY = softClamp(apcaY(textHex));
  const bgY = softClamp(apcaY(bgHex));
  if (Math.abs(bgY - txtY) < APCA.sX) return 0;

  let out;
  if (bgY > txtY) {
    out = (Math.pow(bgY, APCA.nR) - Math.pow(txtY, APCA.nT)) * APCA.sC;
    out = out < APCA.lF ? 0 : out - APCA.lO;
  } else {
    out = (Math.pow(bgY, APCA.sR) - Math.pow(txtY, APCA.sT)) * APCA.sCd;
    out = out > -APCA.lF ? 0 : out + APCA.lOd;
  }
  return out * 100;
}

/** Plain-English guidance for an Lc value. */
export function apcaGuidance(lc) {
  const a = Math.abs(lc);
  if (a >= 90) return { label: 'Any text', tier: 'pass' };
  if (a >= 75) return { label: 'Body text', tier: 'pass' };
  if (a >= 60) return { label: 'Large / medium text', tier: 'pass' };
  if (a >= 45) return { label: 'Headlines only', tier: 'warn' };
  if (a >= 30) return { label: 'Non-text elements', tier: 'warn' };
  if (a >= 15) return { label: 'Decorative only', tier: 'fail' };
  return { label: 'Invisible', tier: 'fail' };
}

/* ------------------------------------------- colour vision deficiency sim */

/** Machado, Oliveira & Fernandes (2009) matrices, severity 1.0. */
const CVD_MATRICES = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

export const CVD_TYPES = [
  { id: 'normal', label: 'Normal vision', note: 'No simulation' },
  { id: 'protanopia', label: 'Protanopia', note: 'No red cones — ~1% of men' },
  { id: 'deuteranopia', label: 'Deuteranopia', note: 'No green cones — ~1% of men' },
  { id: 'tritanopia', label: 'Tritanopia', note: 'No blue cones — very rare' },
  { id: 'achromatopsia', label: 'Achromatopsia', note: 'No colour at all' },
];

export function simulateCVD(hex, type) {
  if (!type || type === 'normal') return normalizeHex(hex);
  const { r, g, b } = hexToRgb(hex);

  if (type === 'achromatopsia') {
    const y = 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
    const v = linearToSrgb(y);
    return rgbToHex({ r: v, g: v, b: v });
  }

  const m = CVD_MATRICES[type];
  if (!m) return normalizeHex(hex);
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  return rgbToHex({
    r: linearToSrgb(clamp(m[0] * lr + m[1] * lg + m[2] * lb, 0, 1)),
    g: linearToSrgb(clamp(m[3] * lr + m[4] * lg + m[5] * lb, 0, 1)),
    b: linearToSrgb(clamp(m[6] * lr + m[7] * lg + m[8] * lb, 0, 1)),
  });
}

/* ------------------------------------------------------------- utilities */

/** Best text colour to sit on a background, chosen from the palette or b/w. */
export function bestTextOn(bgHex, candidates = ['#000000', '#FFFFFF']) {
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const r = contrastRatio(c, bgHex);
    if (r > bestRatio) { bestRatio = r; best = c; }
  }
  return best;
}

export function isLight(hex) {
  return hexToOklch(hex).L > 0.62;
}

/** Human-readable hue family — used in explanations, not in maths. */
export function hueName(h) {
  const names = [
    [15, 'red'], [45, 'orange'], [75, 'yellow'], [110, 'lime'],
    [160, 'green'], [200, 'teal'], [245, 'blue'], [290, 'indigo'],
    [330, 'purple'], [360, 'pink'],
  ];
  for (const [max, name] of names) if (h < max) return name;
  return 'red';
}

export function formatOklch({ L, C, h }) {
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(1)})`;
}
