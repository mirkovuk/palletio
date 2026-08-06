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
import { resolveWorker } from '../config.js';

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
    // Unsplash's API terms require the photographer credited wherever the
    // image appears, both names linked back, and the links tagged so they
    // can see the referral. All carried through to the previews and exports.
    credit: photo.user?.name || 'Unsplash',
    creditUrl: withUTM(photo.user?.links?.html || 'https://unsplash.com'),
    sourceName: 'Unsplash',
    sourceUrl: withUTM('https://unsplash.com'),
    link: photo.links?.html,
    // Hitting this endpoint when a photo is actually used is a condition of
    // the API licence, not an analytics nicety.
    downloadLocation: photo.links?.download_location,
  }));
}

const UTM = 'utm_source=palletio&utm_medium=referral';

function withUTM(url) {
  if (!url) return url;
  return url + (url.includes('?') ? '&' : '?') + UTM;
}

/**
 * Unsplash requires a request to the photo's download endpoint whenever an
 * image is put to use — it is how photographers get credited with a download.
 * Fire-and-forget: a failure here should never interrupt the preview.
 */
export function registerUse(image, settings) {
  if (!image?.downloadLocation) return;

  const worker = resolveWorker(settings);
  if (worker) {
    fetch(`${worker}/images/used?url=${encodeURIComponent(image.downloadLocation)}`).catch(() => {});
    return;
  }

  const key = settings?.unsplashKey?.trim();
  if (!key) return;
  fetch(image.downloadLocation, {
    headers: { Authorization: `Client-ID ${key}` },
  }).catch(() => {});
}

/**
 * Returns a list of candidate images. Falls back to keyless sources rather
 * than failing, so the feature always does something.
 */
export async function findImages({ query, hero, settings, count = 6 }) {
  const worker = resolveWorker(settings);
  const bucket = hero ? nearestBucket(hero) : null;

  /* Worker first. It holds the key server-side, which is the only way every
     visitor gets real imagery — a key in Settings lives in one browser and
     helps exactly one person. */
  if (worker) {
    try {
      const params = new URLSearchParams({ query });
      if (bucket) params.set('color', bucket);
      const res = await fetch(`${worker}/images?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.images?.length) {
          return { source: 'unsplash', images: data.images.slice(0, count), viaWorker: true };
        }
      }
    } catch (e) {
      console.warn('Worker imagery lookup failed, falling back:', e.message);
    }
  }

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
    sourceName: 'Lorem Picsum',
    sourceUrl: 'https://picsum.photos',
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

/**
 * `strength` (0–1) is how far the treatment is taken. At 1 the image is fully
 * remapped into the palette; below that, some of the original photograph
 * survives underneath, which usually blends better with the layout than a
 * hard duotone does.
 *
 * It is applied to both the desaturation and the tint layers together, so
 * dialling it down doesn't leave a grey photo with a colour wash on top —
 * it genuinely returns towards the original.
 */
export function treatmentStyles(
  treatment,
  { shadow, highlight, hero, strength = 1, useHighlight = true }
) {
  const s = Math.max(0, Math.min(1, strength));

  if (treatment === 'original' || s === 0) return { filter: 'none', layers: [] };

  if (treatment === 'tinted') {
    return {
      filter: `saturate(${1 - 0.45 * s}) contrast(${1 + 0.03 * s})`,
      layers: [{ background: hero, mixBlendMode: 'color', opacity: 0.72 * s }],
    };
  }

  const { dark, light } = duotoneLayers(shadow, highlight);
  const layers = [{ background: dark, mixBlendMode: 'lighten', opacity: s }];

  /* The highlight layer is what makes a duotone a duotone, but it also lifts
     the whites towards a single flat colour, which can read as a wash sitting
     on top of the photograph rather than part of it. Without it you get a
     monotone: shadows tinted, highlights left as they are. Often the better
     result, so it is optional. */
  if (useHighlight) {
    layers.push({ background: light, mixBlendMode: 'multiply', opacity: s });
  }

  return {
    filter: `grayscale(${s}) contrast(${1 + 0.08 * s})`,
    layers,
  };
}

/**
 * Which palette colours actually work in each duotone slot. Offering all of
 * them is a false choice — a pale yellow as the shadow end produces nothing,
 * and a near-black highlight collapses the image into a silhouette.
 */
export function duotoneCandidates(colors, slot) {
  const scored = colors
    .map((hex) => ({ hex, L: hexToOklch(hex).L }))
    .sort((a, b) => (slot === 'shadow' ? a.L - b.L : b.L - a.L));

  const usable = scored.filter((c) => (slot === 'shadow' ? c.L < 0.55 : c.L > 0.45));
  return (usable.length ? usable : scored.slice(0, 3)).map((c) => c.hex);
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
