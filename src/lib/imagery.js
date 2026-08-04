/**
 * imagery.js — photography in the sample layouts.
 *
 * The problem with putting a photo in a palette preview is that the photo
 * brings its own colours, and you end up judging the photograph instead of the
 * palette. So the default treatment is duotone: the image is reduced to
 * luminance and remapped between two palette colours. It contributes
 * composition, texture and human presence — the things a flat preview lacks —
 * without contributing a single hue that isn't yours.
 *
 * Original-colour photography is available, but it is the option rather than
 * the default, and it says so.
 *
 * Two sources:
 *   Picsum   — no key, no setup, random photographs. Fine for composition.
 *   Unsplash — needs a key, supports real search and a colour filter, so it
 *              can return images that already sit near your palette.
 */

import { hexToOklch, oklchToHex } from './color.js';

export const TREATMENTS = [
  {
    id: 'duotone',
    label: 'Duotone',
    note: 'Remapped into your palette — adds composition, no foreign colour',
  },
  {
    id: 'tinted',
    label: 'Tinted',
    note: 'Original image under a wash of your hero colour',
  },
  {
    id: 'original',
    label: 'Original',
    note: 'Untouched — realistic, but you are now judging the photo too',
  },
];

/**
 * Unsplash exposes a coarse colour filter with eleven buckets. Mapping the
 * palette's dominant hue onto the nearest one gets images that are already in
 * the right territory, which matters much more for the Original treatment
 * than for duotone.
 */
const UNSPLASH_BUCKETS = [
  { id: 'red', h: 25 },
  { id: 'orange', h: 55 },
  { id: 'yellow', h: 95 },
  { id: 'green', h: 145 },
  { id: 'teal', h: 195 },
  { id: 'blue', h: 250 },
  { id: 'purple', h: 300 },
  { id: 'magenta', h: 330 },
];

export function nearestBucket(hex) {
  const { C, h } = hexToOklch(hex);
  if (C < 0.04) return 'black_and_white';
  let best = UNSPLASH_BUCKETS[0];
  let bestDistance = 360;
  for (const bucket of UNSPLASH_BUCKETS) {
    const d = Math.min(Math.abs(bucket.h - h), 360 - Math.abs(bucket.h - h));
    if (d < bestDistance) { bestDistance = d; best = bucket; }
  }
  return best.id;
}

/* --------------------------------------------------------------- sources */

/** Keyless. Deterministic per seed so a preview does not reshuffle on render. */
function picsumURL(seed, width, height) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

async function unsplashSearch(query, accessKey, colorBucket) {
  const params = new URLSearchParams({
    query,
    per_page: '12',
    orientation: 'landscape',
    content_filter: 'high',
  });
  if (colorBucket) params.set('color', colorBucket);

  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) throw new Error(`Unsplash returned ${res.status}. Check the access key.`);

  const data = await res.json();
  return (data.results || []).map((photo) => ({
    id: photo.id,
    url: photo.urls.regular,
    thumb: photo.urls.thumb,
    // Unsplash's API terms require crediting the photographer wherever an
    // image is displayed. Carried through so the previews can show it.
    credit: photo.user?.name || 'Unsplash',
    creditUrl: photo.user?.links?.html || 'https://unsplash.com',
    link: photo.links?.html,
  }));
}

/**
 * Returns a list of candidate images. Falls back to keyless sources rather
 * than failing, so the feature always does something.
 */
export async function findImages({ query, hero, settings, count = 6 }) {
  const key = settings?.unsplashKey?.trim();

  if (key) {
    try {
      const results = await unsplashSearch(query, key, hero ? nearestBucket(hero) : null);
      if (results.length) return { source: 'unsplash', images: results.slice(0, count) };
    } catch (e) {
      // Fall through to the keyless source rather than leaving the user stuck.
      console.warn('Unsplash lookup failed, falling back:', e.message);
    }
  }

  const images = Array.from({ length: count }, (_, i) => ({
    id: `${query}-${i}`,
    url: picsumURL(`${query}-${i}`, 1200, 800),
    thumb: picsumURL(`${query}-${i}`, 200, 140),
    credit: 'Lorem Picsum',
    creditUrl: 'https://picsum.photos',
  }));
  return { source: 'picsum', images };
}

/* ------------------------------------------------------------- treatment */

/**
 * Duotone as pure CSS, no canvas and no CORS problem.
 *
 * `grayscale(1)` flattens the photograph to luminance; a `lighten` layer in
 * the shadow colour lifts the blacks; a `multiply` layer in the highlight
 * colour tints the whites. The result is a real duotone rather than a colour
 * wash over a colour photo, which is what a simple overlay would give you.
 *
 * Shadow and highlight are pushed apart in lightness first — a duotone built
 * from two colours of similar lightness produces mud.
 */
export function duotoneLayers(shadowHex, highlightHex) {
  const shadow = hexToOklch(shadowHex);
  const highlight = hexToOklch(highlightHex);

  const dark = oklchToHex({ ...shadow, L: Math.min(shadow.L, 0.34) });
  const light = oklchToHex({ ...highlight, L: Math.max(highlight.L, 0.82) });

  return { dark, light };
}

export function treatmentStyles(treatment, { shadow, highlight, hero }) {
  if (treatment === 'original') return { filter: 'none', layers: [] };

  if (treatment === 'tinted') {
    return {
      filter: 'saturate(0.55) contrast(1.03)',
      layers: [{ background: hero, mixBlendMode: 'color', opacity: 0.72 }],
    };
  }

  const { dark, light } = duotoneLayers(shadow, highlight);
  return {
    filter: 'grayscale(1) contrast(1.08)',
    layers: [
      { background: dark, mixBlendMode: 'lighten', opacity: 1 },
      { background: light, mixBlendMode: 'multiply', opacity: 1 },
    ],
  };
}

/**
 * Subject suggestions matched to the vibe of the layout, so the imagery is at
 * least in the same register as the type. Only meaningful with an Unsplash
 * key — the keyless source ignores the query.
 */
export const VIBE_QUERIES = {
  modernist: 'architecture concrete minimal',
  editorial: 'portrait natural light editorial',
  soft: 'texture organic soft light',
  technical: 'machinery detail industrial',
  expressive: 'movement motion abstract',
};
