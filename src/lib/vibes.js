/**
 * vibes.js — typographic and formal presets for the sample layouts.
 *
 * A palette never appears on its own. The same five colours read as a bank, a
 * skincare brand or a festival depending entirely on the type and the shapes
 * around them, so the previews let you swap that context without leaving the
 * tool. These are directions, not templates — the point is to stress-test the
 * colours against different amounts of weight, contrast and white space.
 */

/**
 * `radius` is for small controls — buttons, tags, chips. `radiusCard` is for
 * anything large: cards, inputs, image frames, panels.
 *
 * They are separate because a radius that reads as a confident pill on a
 * 32px-tall button becomes a lozenge on a 300px card. Expressive uses 999px
 * on buttons and 18px on cards for exactly this reason — the shape language
 * is "fully rounded", but applied literally at large sizes it just looks
 * broken.
 */
export const VIBES = [
  {
    id: 'modernist',
    label: 'Modernist',
    note: 'Tight grotesque, flat shapes, no ornament',
    display: "'Clash Display', 'Satoshi', system-ui, sans-serif",
    body: "'Satoshi', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    displayWeight: 600,
    displayTracking: '-0.03em',
    displayCase: 'none',
    bodyWeight: 400,
    radius: '4px',
    radiusCard: '6px',
    shape: 'grid',
    density: 'tight',
    heroScale: 1,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    note: 'High-contrast serif, generous measure',
    display: "'Instrument Serif', Georgia, serif",
    body: "'Satoshi', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    displayWeight: 400,
    displayTracking: '-0.01em',
    displayCase: 'none',
    bodyWeight: 400,
    radius: '2px',
    radiusCard: '2px',
    shape: 'rule',
    density: 'airy',
    heroScale: 1.15,
  },
  {
    id: 'soft',
    label: 'Soft',
    note: 'Rounded forms, organic blobs, low contrast',
    display: "'General Sans', system-ui, sans-serif",
    body: "'General Sans', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    displayWeight: 600,
    displayTracking: '-0.02em',
    displayCase: 'none',
    bodyWeight: 400,
    radius: '24px',
    radiusCard: '20px',
    shape: 'blob',
    density: 'airy',
    heroScale: 0.95,
  },
  {
    id: 'technical',
    label: 'Technical',
    note: 'Monospaced labels, hairlines, hard edges',
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Satoshi', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    displayWeight: 500,
    displayTracking: '-0.02em',
    displayCase: 'none',
    bodyWeight: 400,
    radius: '0px',
    radiusCard: '0px',
    shape: 'hairline',
    density: 'tight',
    heroScale: 0.9,
  },
  {
    id: 'expressive',
    label: 'Expressive',
    note: 'Oversized display, cropped type, high energy',
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    body: "'Satoshi', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    displayWeight: 800,
    displayTracking: '-0.045em',
    displayCase: 'none',
    bodyWeight: 500,
    radius: '999px',
    radiusCard: '18px',
    shape: 'arc',
    density: 'tight',
    heroScale: 1.3,
  },
];

export function getVibe(id) {
  return VIBES.find((v) => v.id === id) || VIBES[0];
}

/**
 * Maps roles onto the surfaces a layout actually needs. Previews have to work
 * before the user reaches step 4, so this degrades gracefully: if there is no
 * dark neutral, body text falls back to the darkest thing available rather
 * than silently rendering invisible type.
 */
export function surfaceMap(colors, roles) {
  const byRole = (role) => colors.filter((c) => roles[c] === role);
  const lights = byRole('light-neutral');
  const darks = byRole('dark-neutral');
  const heroes = byRole('hero');
  const accents = byRole('accent');

  const sortByLightness = (list, dir = 1) =>
    [...list].sort((a, b) => dir * (lightnessOf(a) - lightnessOf(b)));

  const fallbackLight = sortByLightness(colors, -1)[0] || '#FFFFFF';
  const fallbackDark = sortByLightness(colors, 1)[0] || '#111111';

  const page = sortByLightness(lights, -1)[0] || fallbackLight;
  const surface = sortByLightness(lights, -1)[1] || page;
  const ink = sortByLightness(darks, 1)[0] || fallbackDark;
  const hero = heroes[0] || accents[0] || ink;
  const accent = accents.find((a) => a !== hero) || accents[0] || hero;
  const accent2 = accents.filter((a) => a !== hero && a !== accent)[0] || accent;

  return { page, surface, ink, hero, accent, accent2, all: colors };
}

function lightnessOf(hex) {
  // Local, cheap approximation — the previews re-render on every drag and do
  // not need full OKLab precision for ordering.
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
