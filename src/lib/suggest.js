/**
 * suggest.js — proposes colours that fill the gaps in a palette.
 *
 * Rule the whole file obeys: every suggestion is derived from a colour the user
 * already chose. Generic greys and randomly generated hues are what make a
 * palette look assembled rather than designed, so neutrals are tinted with the
 * palette's own hue and harmony colours are rotations of a real brand colour.
 */

import { hexToOklch, oklchToHex, deltaEOK, hueName, clamp } from './color.js';
import { isNeutral } from './harmony.js';

function seedColor(colors) {
  const chromatic = colors.filter((c) => !isNeutral(c));
  if (!chromatic.length) return null;
  // Prefer the most "usable" mid-tone as the seed rather than the first entry.
  return chromatic
    .map((c) => ({ hex: c, lch: hexToOklch(c) }))
    .sort((a, b) => {
      const scoreOf = (x) => x.lch.C * (1 - Math.abs(x.lch.L - 0.6));
      return scoreOf(b) - scoreOf(a);
    })[0];
}

function dominantHue(colors) {
  const seed = seedColor(colors);
  return seed ? seed.lch.h : 40;
}

function unique(list, existing, minDistance = 0.045) {
  const out = [];
  for (const item of list) {
    const clashes = [...existing, ...out.map((o) => o.hex)].some(
      (e) => deltaEOK(e, item.hex) < minDistance
    );
    if (!clashes) out.push(item);
  }
  return out;
}

/* ---------------------------------------------------------------- neutrals */

export function suggestLightNeutrals(colors, count = 6) {
  const h = dominantHue(colors);
  const out = [];
  // Tint amounts chosen so the warmth is felt but not named — above ~0.02
  // chroma at this lightness the "neutral" starts reading as a colour.
  const recipes = [
    { L: 0.975, C: 0.004, note: 'Barely-there tint — safe as a page background' },
    { L: 0.955, C: 0.008, note: 'Softer than white, still reads as neutral' },
    { L: 0.93, C: 0.012, note: 'Card surface that separates from the page' },
    { L: 0.9, C: 0.016, note: 'Warm base for large fills' },
    { L: 0.87, C: 0.022, note: 'Deeper wash — good for alternating sections' },
    { L: 0.94, C: 0.006, hShift: 180, note: 'Cool counterpoint to your warm colours' },
    { L: 0.91, C: 0.018, hShift: -25, note: 'Tinted towards your secondary hue' },
  ];
  for (const r of recipes) {
    const hex = oklchToHex({ L: r.L, C: r.C, h: (h + (r.hShift || 0) + 360) % 360 });
    out.push({ hex, kind: 'light-neutral', note: r.note });
  }
  return unique(out, colors, 0.03).slice(0, count);
}

export function suggestDarkNeutrals(colors, count = 6) {
  const h = dominantHue(colors);
  const out = [];
  const recipes = [
    { L: 0.22, C: 0.012, note: 'Near-black with a trace of your hue — better than #000' },
    { L: 0.28, C: 0.02, note: 'Body text that feels part of the family' },
    { L: 0.34, C: 0.028, note: 'Softer text tone for long reading' },
    { L: 0.19, C: 0.008, note: 'Deepest anchor — headlines and dark sections' },
    { L: 0.26, C: 0.018, hShift: 180, note: 'Cool-shifted dark, contrasts warm accents' },
    { L: 0.42, C: 0.03, note: 'Mid-dark for secondary text and borders' },
  ];
  for (const r of recipes) {
    const hex = oklchToHex({ L: r.L, C: r.C, h: (h + (r.hShift || 0) + 360) % 360 });
    out.push({ hex, kind: 'dark-neutral', note: r.note });
  }
  return unique(out, colors, 0.03).slice(0, count);
}

/* ---------------------------------------------------------------- harmony */

const RELATIONS = [
  { id: 'analogous', angles: [28, -28, 42], label: 'Analogous' },
  { id: 'complement', angles: [180], label: 'Complementary' },
  { id: 'split', angles: [155, -155], label: 'Split complementary' },
  { id: 'triadic', angles: [120, -120], label: 'Triadic' },
  { id: 'tetradic', angles: [90, -90], label: 'Tetradic' },
];

const RELATION_NOTES = {
  analogous: (base) => `Sits next to your ${base} — extends the family without introducing tension`,
  complement: (base) => `Opposite your ${base} — maximum separation, use sparingly for emphasis`,
  split: (base) => `Near-opposite your ${base} — contrast without the harshness of a true complement`,
  triadic: (base) => `Evenly spaced from your ${base} — balanced tension across the wheel`,
  tetradic: (base) => `Quarter-turn from your ${base} — adds a second axis to the palette`,
};

export function suggestHarmony(colors, count = 8) {
  const seed = seedColor(colors);
  if (!seed) {
    // Nothing chromatic yet — offer a spread the user can react to.
    return [0, 45, 140, 210, 280, 330].map((h) => ({
      hex: oklchToHex({ L: 0.68, C: 0.13, h }),
      kind: 'harmony',
      relation: 'Starting point',
      note: `A ${hueName(h)} to build from — swap it for your own brand colour any time`,
    }));
  }

  const base = hueName(seed.lch.h);
  const out = [];

  for (const rel of RELATIONS) {
    for (const angle of rel.angles) {
      const h = (seed.lch.h + angle + 360) % 360;
      // Lightness variants so suggestions aren't all the same tonal weight —
      // a palette needs range, not just hue coverage.
      for (const dL of [0, 0.14, -0.14]) {
        const L = clamp(seed.lch.L + dL, 0.32, 0.88);
        const C = clamp(seed.lch.C * (dL === 0 ? 1 : 0.85), 0.04, 0.2);
        out.push({
          hex: oklchToHex({ L, C, h }),
          kind: 'harmony',
          relation: rel.label,
          note: RELATION_NOTES[rel.id](base),
        });
      }
    }
  }

  // Tonal variations of the seed itself — often the most useful and the thing
  // generic generators never offer.
  for (const dL of [0.2, -0.2, 0.3]) {
    const L = clamp(seed.lch.L + dL, 0.25, 0.92);
    out.push({
      hex: oklchToHex({ L, C: seed.lch.C * 0.9, h: seed.lch.h }),
      kind: 'harmony',
      relation: 'Tonal variation',
      note: `${dL > 0 ? 'Lighter' : 'Deeper'} version of ${seed.hex} — hover states, tints, and layering`,
    });
  }

  return shuffleStable(unique(out, colors, 0.05)).slice(0, count);
}

/** Deterministic-ish shuffle so a re-render doesn't reorder under the cursor. */
function shuffleStable(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function suggestAll(colors) {
  return {
    lightNeutral: suggestLightNeutrals(colors),
    darkNeutral: suggestDarkNeutrals(colors),
    harmony: suggestHarmony(colors),
  };
}
