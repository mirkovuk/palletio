/**
 * describe.js — plain-language description of what a palette feels like.
 *
 * Derived entirely from the same metrics the Character sliders show, so the
 * description and the sliders can never disagree. It updates the moment a
 * colour changes.
 *
 * Deliberately not a model call. A model would be slower than dragging, would
 * need an API key, and — worse — would produce something plausible rather than
 * something derived. If the sliders say muted and the sentence says vibrant,
 * the tool has lied. This way it cannot.
 *
 * The descriptions are impressions, not verdicts. There is no correct place to
 * sit on these axes; the value is in noticing when a palette reads differently
 * from how you intended it to.
 */

import { hexToOklch, hueName } from './color.js';
import { paletteMetrics, isNeutral, coverage } from './harmony.js';

/* ------------------------------------------------------------------ bands */

function band(value, cuts) {
  for (let i = 0; i < cuts.length; i++) if (value < cuts[i]) return i;
  return cuts.length;
}

const TEMPERATURE = ['distinctly cool', 'cool', 'balanced', 'warm', 'distinctly warm'];
const VIBRANCE = ['almost colourless', 'muted', 'restrained', 'vivid', 'intense'];
const LIGHTNESS = ['dark', 'deep', 'mid-weight', 'light', 'very light'];
const VARIETY = ['single-hued', 'tightly related', 'moderately varied', 'broad', 'scattered'];

/**
 * The Character sliders exclude neutrals — including them would drag every
 * palette towards muted and mono and tell you nothing about your *colours*.
 * But a description of how the palette *feels* has to count them, because
 * neutrals occupy the most area in any real layout. A palette of three neons
 * on near-black is a dark palette, whatever its three chromatic colours say.
 *
 * So lightness here is measured across everything, and the descriptor says so
 * rather than quietly disagreeing with the sliders above it.
 */
function overallLightness(colors) {
  const total = colors.reduce((sum, hex) => sum + hexToOklch(hex).L, 0);
  return total / colors.length;
}

/* -------------------------------------------------------------- headline */

/**
 * Headline comes from the two axes furthest from centre — the qualities a
 * viewer would name first. Selection is deterministic, so the same palette
 * always produces the same words.
 */
const HEADLINES = {
  'warm+light': ['Soft and sunlit', 'Warm, open, unhurried'],
  'warm+dark': ['Rich and enclosed', 'Warm but heavy — firelit rather than sunlit'],
  'warm+vivid': ['Loud and warm', 'High-energy warmth'],
  'warm+muted': ['Weathered and warm', 'Warm but faded, like something sun-bleached'],
  'cool+light': ['Clean and cool', 'Cool and airy'],
  'cool+dark': ['Cold and deep', 'Nocturnal'],
  'cool+vivid': ['Electric and cool', 'Cool with a hard edge'],
  'cool+muted': ['Overcast', 'Cool and quiet — the palette of weather, not colour'],
  'light+muted': ['Quiet and pale', 'Barely-there'],
  'light+vivid': ['Bright and clear', 'Light but not soft'],
  'dark+vivid': ['Dense and saturated', 'Dark, with colour pushing through'],
  'dark+muted': ['Sombre', 'Low and unlit'],
  'vivid+broad': ['Busy and energetic', 'A lot happening at once'],
  'muted+single-hued': ['Almost monotone', 'Nearly one colour, quietly varied'],
  default: ['Balanced and unremarkable — in the useful sense', 'Even-tempered'],
};

/* When no pairing matches, name the one quality that is actually pronounced
   rather than falling back to "balanced", which would be untrue. */
const SINGLE_AXIS = {
  warm: ['Warm throughout', 'Unmistakably warm'],
  cool: ['Cool throughout', 'Unmistakably cool'],
  vivid: ['Saturated', 'Turned all the way up'],
  muted: ['Understated', 'Deliberately quiet'],
  light: ['Light and open', 'Almost entirely pale'],
  dark: ['Dark and grounded', 'Weighted towards the dark end'],
  broad: ['Wide-ranging', 'Spread right across the wheel'],
  'single-hued': ['Held to one hue', 'Essentially monochrome'],
};

function pickHeadline(bands, metrics) {
  const distance = {
    temperature: Math.abs(metrics.temperature - 0.5),
    vibrance: Math.abs(metrics.vibrance - 0.5),
    lightness: Math.abs(metrics.lightness - 0.5),
    variety: Math.abs(metrics.variety - 0.5),
  };

  const tokens = {
    temperature: metrics.temperature > 0.5 ? 'warm' : 'cool',
    vibrance: metrics.vibrance > 0.5 ? 'vivid' : 'muted',
    lightness: metrics.lightness > 0.5 ? 'light' : 'dark',
    variety: metrics.variety > 0.5 ? 'broad' : 'single-hued',
  };

  /* With almost no chroma present, temperature is a technically real but
     perceptually weak reading — it should not lead the headline. A warm grey
     is a grey first. */
  if (bands.vibrance === 0) distance.temperature *= 0.35;

  const ranked = Object.entries(distance).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;

  // Nothing is far enough from centre to be worth naming.
  if (first[1] < 0.14) return HEADLINES.default[0];

  const keyA = `${tokens[first[0]]}+${tokens[second[0]]}`;
  const keyB = `${tokens[second[0]]}+${tokens[first[0]]}`;
  const options = HEADLINES[keyA] || HEADLINES[keyB] || SINGLE_AXIS[tokens[first[0]]];
  if (!options) return HEADLINES.default[0];

  // Second variant when the leading quality is emphatic rather than mild.
  return first[1] > 0.32 && options[1] ? options[1] : options[0];
}

/* ------------------------------------------------------------------ hues */

function hueSummary(colors) {
  const chromatic = colors.filter((c) => !isNeutral(c));
  if (!chromatic.length) return null;

  const counts = new Map();
  for (const hex of chromatic) {
    const name = hueName(hexToOklch(hex).h);
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  if (ordered.length === 1) return ordered[0];
  if (ordered.length === 2) return `${ordered[0]} and ${ordered[1]}`;
  return `${ordered.slice(0, -1).join(', ')} and ${ordered[ordered.length - 1]}`;
}

/* ---------------------------------------------------------- associations */

/**
 * Where a palette in this territory tends to be found. Offered as recognition,
 * not instruction — knowing your palette reads like the sector next door is
 * useful whether you want that or not.
 */
function associations(bands, metrics) {
  const out = [];
  const { temperature: t, vibrance: v, lightness: l, variety: va } = metrics;

  if (l > 0.72 && v < 0.42) out.push('wellness, skincare, editorial print');
  if (l > 0.72 && v > 0.6) out.push('consumer tech, direct-to-consumer retail');
  if (l < 0.4 && v < 0.4) out.push('luxury, tailoring, spirits');
  if (l < 0.4 && v > 0.55) out.push('gaming, nightlife, streetwear');
  if (t > 0.7 && v < 0.5) out.push('hospitality, food, craft');
  if (t < 0.35 && v < 0.45) out.push('finance, healthcare, enterprise software');
  if (t < 0.35 && v > 0.6) out.push('fintech, developer tools');
  if (va > 0.7) out.push('education, children, festivals');
  if (va < 0.25) out.push('architecture, fashion, cultural institutions');

  return [...new Set(out)].slice(0, 2);
}

/* -------------------------------------------------------------- cautions */

/**
 * What this character will make difficult. Not the same as the harmony flags:
 * those are faults, these are consequences of a legitimate choice.
 */
function cautions(metrics, cov, colors) {
  const out = [];
  const { vibrance: v, lightness: l, variety: va, temperature: t } = metrics;

  if (l > 0.78 && v < 0.4) {
    out.push('Everything sits in a narrow, pale band, so hierarchy will have to come from type and space rather than colour.');
  }
  if (l < 0.3) {
    out.push('Predominantly dark palettes need more care with type weight — light text on dark grounds looks heavier than the same weight the other way round.');
  }
  if (v > 0.75) {
    out.push('At this saturation, two of these next to each other will vibrate. Give them neutral space rather than shared edges.');
  }
  if (va > 0.78) {
    out.push('With hues spread this wide, nothing reads as the brand colour by default — role assignment is doing more work than usual here.');
  }
  if (va < 0.18 && colors.filter((c) => !isNeutral(c)).length > 2) {
    out.push('Nearly one hue throughout. Distinctive, but it leaves no second colour to signal a different kind of moment.');
  }
  if (t > 0.85) {
    out.push('Uniformly warm. A single cool note would give the warmth something to be warm against.');
  }
  if (t < 0.15) {
    out.push('Uniformly cool. Without a warm note this can read as clinical rather than calm.');
  }
  if (!cov.hasDarkNeutral && !cov.hasLightNeutral) {
    out.push('No neutrals at all — every surface in a layout would have to be a saturated colour.');
  }

  return out.slice(0, 2);
}

/* ----------------------------------------------------------------- main */

export function describePalette(colors) {
  if (!colors || colors.length < 2) return null;

  const metrics = paletteMetrics(colors);
  const cov = coverage(colors);

  const lightness = overallLightness(colors);
  const feel = { ...metrics, lightness };

  const bands = {
    temperature: band(metrics.temperature, [0.2, 0.4, 0.6, 0.8]),
    vibrance: band(metrics.vibrance, [0.2, 0.4, 0.6, 0.8]),
    lightness: band(lightness, [0.3, 0.45, 0.6, 0.75]),
    variety: band(metrics.variety, [0.2, 0.4, 0.6, 0.8]),
  };

  /* A palette with almost no chroma cannot meaningfully be called warm or
     cool — the hue reading is real but it is doing no perceptual work, and
     calling a beige "distinctly warm" overstates it. Pull the claim inward. */
  if (bands.vibrance === 0) {
    bands.temperature = Math.max(1, Math.min(3, bands.temperature));
  }

  const hues = hueSummary(colors);
  const neutralCount = colors.filter(isNeutral).length;

  const sentences = [];

  sentences.push(
    `${LIGHTNESS[bands.lightness].replace(/^./, (c) => c.toUpperCase())}, ` +
    `${TEMPERATURE[bands.temperature]} and ${VIBRANCE[bands.vibrance]}` +
    (hues ? `, built on ${hues}.` : '.')
  );

  const varietyLine = {
    0: 'Everything sits on effectively one hue, so the palette moves through tone rather than colour.',
    1: 'The hues stay close together, which keeps things cohesive at the cost of contrast between them.',
    2: 'Enough spread between hues to distinguish them, without the palette pulling apart.',
    3: 'A broad spread of hues — plenty of range, and enough distance that they need managing.',
    4: 'The hues are scattered across the wheel, which reads as variety or as indecision depending on how the roles are set.',
  }[bands.variety];
  sentences.push(varietyLine);

  if (neutralCount > 0) {
    sentences.push(
      neutralCount === 1
        ? 'One neutral is carrying every surface and every piece of text.'
        : `${neutralCount} neutrals give the colours somewhere to sit.`
    );
  }

  return {
    headline: pickHeadline(bands, feel),
    body: sentences.join(' '),
    associations: associations(bands, feel),
    cautions: cautions(feel, cov, colors),
    bands,
    metrics: feel,
  };
}
