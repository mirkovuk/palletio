/**
 * harmony.js — palette diagnosis.
 *
 * Every flag has to answer two questions honestly: what is wrong, and what
 * specifically would fix it. A flag with no actionable fix is just criticism.
 */

import {
  hexToOklch, oklchToHex, deltaEOK, hueDistance, hueName, clamp,
} from './color.js';

/* Neutral = low chroma. The threshold rises with lightness because a pale
   colour needs less chroma to read as tinted than a mid-tone does. */
export function isNeutral(hex) {
  const { L, C } = hexToOklch(hex);
  return C < 0.035 + L * 0.02;
}

export function classify(hex) {
  const { L, C } = hexToOklch(hex);
  if (isNeutral(hex)) return L > 0.6 ? 'light-neutral' : 'dark-neutral';
  if (L > 0.85) return 'pale';
  if (L < 0.28) return 'deep';
  return C > 0.14 ? 'vivid' : 'muted';
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Circular mean + spread for hues, in degrees. */
function hueStats(hues) {
  if (!hues.length) return { mean: 0, spread: 0 };
  let x = 0, y = 0;
  for (const h of hues) {
    x += Math.cos((h * Math.PI) / 180);
    y += Math.sin((h * Math.PI) / 180);
  }
  x /= hues.length;
  y /= hues.length;
  const R = Math.sqrt(x * x + y * y);
  let mean = (Math.atan2(y, x) * 180) / Math.PI;
  if (mean < 0) mean += 360;
  return { mean, spread: 1 - R }; // 0 = all one hue, 1 = evenly scattered
}

/* --------------------------------------------------------------- metrics */

/**
 * The four character axes shown as sliders. Neutrals are excluded — including
 * them would drag every palette towards "muted" and "mono" and tell you nothing.
 */
export function paletteMetrics(colors) {
  const chromatic = colors.filter((c) => !isNeutral(c));
  const source = chromatic.length ? chromatic : colors;
  const lch = source.map(hexToOklch);

  const meanL = lch.reduce((s, c) => s + c.L, 0) / lch.length;
  const meanC = lch.reduce((s, c) => s + c.C, 0) / lch.length;
  const { spread } = hueStats(lch.filter((c) => c.C > 0.02).map((c) => c.h));

  // Warmth: how much of the palette sits in the 0–110 / 330–360 arc,
  // weighted by chroma so a pale grey-blue doesn't count as strongly as a red.
  let warmWeight = 0, totalWeight = 0;
  for (const c of lch) {
    const w = Math.max(c.C, 0.01);
    const warm = c.h < 110 || c.h > 330 ? 1 : c.h < 200 ? 0.35 : 0;
    warmWeight += warm * w;
    totalWeight += w;
  }

  return {
    temperature: totalWeight ? warmWeight / totalWeight : 0.5,
    vibrance: clamp(meanC / 0.2, 0, 1),
    lightness: clamp(meanL, 0, 1),
    variety: clamp(spread * 1.6, 0, 1),
  };
}

/* -------------------------------------------------------------- coverage */

/**
 * A palette isn't a brand system until it can build a page: something to put
 * behind everything, something to write with, and something to draw the eye.
 */
export function coverage(colors) {
  const lightNeutral = colors.filter((c) => isNeutral(c) && hexToOklch(c).L > 0.82);
  const darkNeutral = colors.filter((c) => isNeutral(c) && hexToOklch(c).L < 0.35);
  const chromatic = colors.filter((c) => !isNeutral(c));
  const midChromatic = chromatic.filter((c) => {
    const { L } = hexToOklch(c);
    return L > 0.35 && L < 0.8;
  });

  return {
    lightNeutral: lightNeutral.length,
    darkNeutral: darkNeutral.length,
    chromatic: chromatic.length,
    midChromatic: midChromatic.length,
    hasLightNeutral: lightNeutral.length > 0,
    hasDarkNeutral: darkNeutral.length > 0,
    hasAnchor: midChromatic.length > 0,
  };
}

/* ---------------------------------------------------------------- issues */

/**
 * Returns flags, each with a concrete replacement hex where a fix exists.
 * severity: 'high' blocks a usable system, 'medium' is a real wobble,
 * 'low' is a nudge you can ignore.
 */
export function findIssues(colors) {
  const issues = [];
  if (colors.length < 2) return issues;

  const lch = colors.map(hexToOklch);
  const chromaticIdx = colors.map((c, i) => (isNeutral(c) ? -1 : i)).filter((i) => i >= 0);
  const chromas = chromaticIdx.map((i) => lch[i].C);
  const medC = median(chromas);

  /* 1. Near-duplicates. Two colours a viewer can't distinguish are two ways
        to make the same decision — one of them is dead weight. */
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = deltaEOK(colors[i], colors[j]);
      if (d < 0.035) {
        issues.push({
          id: `dup-${i}-${j}`,
          index: j,
          partner: i,
          type: 'duplicate',
          severity: d < 0.02 ? 'high' : 'medium',
          title: 'Nearly identical to another colour',
          detail: `${colors[j]} and ${colors[i]} are ${d < 0.02 ? 'indistinguishable' : 'very close'} in perceptual terms. Keeping both adds ambiguity without adding range.`,
          fix: null,
          fixLabel: 'Remove this colour',
          action: 'remove',
        });
      }
    }
  }

  /* 2. Chroma outliers — the classic "one colour screams". */
  if (chromaticIdx.length >= 3 && medC > 0.01) {
    for (const i of chromaticIdx) {
      const ratio = lch[i].C / medC;
      if (ratio > 2.1) {
        const target = medC * 1.35;
        issues.push({
          id: `chroma-hi-${i}`,
          index: i,
          type: 'too-vibrant',
          severity: ratio > 3 ? 'high' : 'medium',
          title: 'Much more saturated than the rest',
          detail: `This ${hueName(lch[i].h)} carries roughly ${ratio.toFixed(1)}× the chroma of your other colours, so it will dominate any layout it appears in — even at small sizes.`,
          fix: oklchToHex({ ...lch[i], C: target }),
          fixLabel: 'Bring saturation into line',
          action: 'replace',
        });
      } else if (ratio < 0.4 && chromas.length > 2) {
        issues.push({
          id: `chroma-lo-${i}`,
          index: i,
          type: 'too-muted',
          severity: 'low',
          title: 'Much flatter than the rest',
          detail: `Next to your other colours this reads as almost neutral, so it may not carry the weight you expect from an accent.`,
          fix: oklchToHex({ ...lch[i], C: medC * 0.8 }),
          fixLabel: 'Lift saturation',
          action: 'replace',
        });
      }
    }
  }

  /* 3. Lightness crowding — several colours at the same L can't be told
        apart in greyscale, which is how they'll print and how a screen
        reader user's contrast experience is shaped. */
  const bands = {};
  colors.forEach((c, i) => {
    if (isNeutral(c)) return;
    const band = Math.round(lch[i].L * 10);
    (bands[band] ||= []).push(i);
  });
  for (const [, group] of Object.entries(bands)) {
    if (group.length >= 3) {
      const sorted = [...group].sort((a, b) => lch[a].L - lch[b].L);
      const mid = sorted[Math.floor(sorted.length / 2)];
      issues.push({
        id: `band-${mid}`,
        index: mid,
        type: 'lightness-crowding',
        severity: 'medium',
        title: 'Three or more colours share this lightness',
        detail: `${group.length} of your colours sit at nearly the same perceptual lightness. They will collapse into one tone in greyscale, in low light, and for anyone with reduced colour vision.`,
        fix: oklchToHex({ ...lch[mid], L: clamp(lch[mid].L - 0.16, 0.08, 0.95) }),
        fixLabel: 'Push this one darker',
        action: 'replace',
      });
    }
  }

  /* 4. Hue orphans — a colour with no relationship to anything else. */
  if (chromaticIdx.length >= 3) {
    for (const i of chromaticIdx) {
      const others = chromaticIdx.filter((j) => j !== i);
      const nearest = Math.min(...others.map((j) => hueDistance(lch[i].h, lch[j].h)));
      if (nearest > 75 && nearest < 155) {
        const { mean } = hueStats(others.map((j) => lch[j].h));
        const towards = ((mean - lch[i].h + 540) % 360) - 180;
        issues.push({
          id: `orphan-${i}`,
          index: i,
          type: 'hue-orphan',
          severity: 'medium',
          title: 'Unrelated to the rest of the palette',
          detail: `This ${hueName(lch[i].h)} sits ${Math.round(nearest)}° from its nearest neighbour — too far to feel analogous, too near to read as a deliberate complement.`,
          fix: oklchToHex({ ...lch[i], h: (lch[i].h + Math.sign(towards) * Math.min(Math.abs(towards), nearest - 45) + 360) % 360 }),
          fixLabel: 'Pull it towards the family',
          action: 'replace',
        });
      }
    }
  }

  /* 5. Colours too dark or too pale to be usable as anything but an edge case. */
  colors.forEach((c, i) => {
    if (isNeutral(c)) return;
    if (lch[i].L > 0.93) {
      issues.push({
        id: `pale-${i}`,
        index: i,
        type: 'too-pale',
        severity: 'low',
        title: 'Too pale to hold text',
        detail: `At this lightness nothing dark will look intentional on it and nothing light will be readable. It works as a wash, not as a surface you can build on.`,
        fix: oklchToHex({ ...lch[i], L: 0.86 }),
        fixLabel: 'Deepen slightly',
        action: 'replace',
      });
    }
    if (lch[i].L < 0.22 && lch[i].C > 0.06) {
      issues.push({
        id: `dark-${i}`,
        index: i,
        type: 'too-dark',
        severity: 'low',
        title: 'Colour is lost at this darkness',
        detail: `The hue is barely perceptible here — most people will read this as near-black, so the saturation is doing no work.`,
        fix: oklchToHex({ ...lch[i], L: 0.34 }),
        fixLabel: 'Lift so the hue reads',
        action: 'replace',
      });
    }
  });

  /* 6. Structural gaps. */
  const cov = coverage(colors);
  if (!cov.hasLightNeutral) {
    issues.push({
      id: 'gap-light',
      index: null,
      type: 'missing-light-neutral',
      severity: 'high',
      title: 'No light neutral',
      detail: 'There is nothing here to use as a page background or a card surface. Without one, every layout has to sit on pure white or on a saturated colour.',
      fix: null,
      fixLabel: 'Add one from suggestions',
      action: 'suggest',
    });
  }
  if (!cov.hasDarkNeutral) {
    issues.push({
      id: 'gap-dark',
      index: null,
      type: 'missing-dark-neutral',
      severity: 'high',
      title: 'No dark neutral',
      detail: 'There is nothing here to set body text in. Defaulting to pure black against a warm palette is what makes a brand look untuned.',
      fix: null,
      fixLabel: 'Add one from suggestions',
      action: 'suggest',
    });
  }
  if (!cov.hasAnchor && colors.length > 2) {
    issues.push({
      id: 'gap-anchor',
      index: null,
      type: 'missing-anchor',
      severity: 'medium',
      title: 'No mid-tone colour to lead with',
      detail: 'Every chromatic colour is either very pale or very dark. There is no candidate for a hero — the colour that carries buttons, links and brand moments.',
      fix: null,
      fixLabel: 'Add one from suggestions',
      action: 'suggest',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ----------------------------------------------------------------- score */

/**
 * Health, 0–100. Deliberately not a vibe: it is coverage plus penalties, and
 * the breakdown is exposed so you can disagree with it.
 */
export function healthScore(colors) {
  if (!colors.length) return { score: 0, breakdown: [] };

  const issues = findIssues(colors);
  const cov = coverage(colors);
  const breakdown = [];

  let score = 100;
  const weights = { high: 14, medium: 7, low: 3 };
  const counted = {};

  for (const issue of issues) {
    counted[issue.severity] = (counted[issue.severity] || 0) + 1;
    score -= weights[issue.severity];
  }
  for (const [sev, n] of Object.entries(counted)) {
    breakdown.push({ label: `${n} ${sev}-severity ${n === 1 ? 'issue' : 'issues'}`, delta: -weights[sev] * n });
  }

  if (colors.length < 4) {
    score -= 8;
    breakdown.push({ label: 'Fewer than four colours', delta: -8 });
  }
  if (colors.length > 12) {
    score -= 6;
    breakdown.push({ label: 'More than twelve colours', delta: -6 });
  }
  if (cov.hasLightNeutral && cov.hasDarkNeutral && cov.hasAnchor) {
    breakdown.push({ label: 'Complete role coverage', delta: 0 });
  }

  return { score: Math.round(clamp(score, 0, 100)), breakdown, issueCount: issues.length };
}

export function scoreBand(score) {
  if (score >= 85) return { label: 'Ready to use', tone: 'good' };
  if (score >= 65) return { label: 'Nearly there', tone: 'ok' };
  if (score >= 40) return { label: 'Needs work', tone: 'warn' };
  return { label: 'Not usable yet', tone: 'bad' };
}
