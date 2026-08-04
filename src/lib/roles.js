/**
 * roles.js — turning a set of colours into a system.
 *
 * A palette is a list. A system says which colour does which job. Everything
 * downstream — the previews, the CSS export, the pairing recommendations —
 * depends on roles, so they are inferred automatically the moment a colour is
 * added and can be overridden at any point.
 */

import { hexToOklch, contrastRatio, apcaContrast, wcagLevels, apcaGuidance } from './color.js';
import { isNeutral } from './harmony.js';

export const ROLES = [
  { id: 'hero', label: 'Hero', note: 'The colour the brand is remembered by' },
  { id: 'accent', label: 'Accent', note: 'Supporting colour, used in moments' },
  { id: 'light-neutral', label: 'Light neutral', note: 'Backgrounds and surfaces' },
  { id: 'dark-neutral', label: 'Dark neutral', note: 'Text and dark sections' },
];

export const ROLE_WEIGHT = {
  hero: 3,
  accent: 2,
  'light-neutral': 1,
  'dark-neutral': 1,
};

/**
 * Infers a role for a single colour, given the rest of the palette.
 * Hero is awarded to exactly one colour: the most chromatic mid-tone, because
 * that is the one that can survive being a button, a fill and a piece of type.
 */
export function inferRoles(colors, existing = {}) {
  const roles = {};
  let heroCandidate = null;
  let heroScore = -1;

  colors.forEach((hex) => {
    const { L, C } = hexToOklch(hex);
    if (isNeutral(hex)) {
      roles[hex] = L > 0.6 ? 'light-neutral' : 'dark-neutral';
    } else {
      roles[hex] = 'accent';
      // Usable-as-hero score: saturated, but not so light or dark that white
      // or black text fails on it.
      const usable = 1 - Math.abs(L - 0.62) * 1.8;
      const score = C * Math.max(usable, 0.05);
      if (score > heroScore) {
        heroScore = score;
        heroCandidate = hex;
      }
    }
  });

  if (heroCandidate) roles[heroCandidate] = 'hero';

  // Anything the user set by hand wins.
  for (const [hex, role] of Object.entries(existing)) {
    if (colors.includes(hex)) roles[hex] = role;
  }

  // Never allow two heroes — the most recent manual choice keeps it.
  const heroes = Object.entries(roles).filter(([, r]) => r === 'hero');
  if (heroes.length > 1) {
    const manualHero = heroes.find(([hex]) => existing[hex] === 'hero');
    heroes.forEach(([hex]) => {
      if (!manualHero || hex !== manualHero[0]) roles[hex] = 'accent';
    });
    if (manualHero) roles[manualHero[0]] = 'hero';
  }

  return roles;
}

export function groupByRole(colors, roles) {
  const groups = { hero: [], accent: [], 'light-neutral': [], 'dark-neutral': [] };
  colors.forEach((hex) => {
    const role = roles[hex] || 'accent';
    (groups[role] ||= []).push(hex);
  });
  return groups;
}

/* -------------------------------------------------------------- pairings */

/**
 * Every ordered pair, both directions. Order matters: #333 on #EEE and #EEE on
 * #333 are the same WCAG ratio but genuinely different APCA scores, and only
 * one of them is a design you'd ship.
 */
export function buildPairings(colors) {
  const pairs = [];
  for (const text of colors) {
    for (const bg of colors) {
      if (text === bg) continue;
      const ratio = contrastRatio(text, bg);
      const lc = apcaContrast(text, bg);
      pairs.push({
        id: `${text}-on-${bg}`,
        text,
        bg,
        ratio,
        lc,
        wcag: wcagLevels(ratio),
        apca: apcaGuidance(lc),
      });
    }
  }
  return pairs.sort((a, b) => b.ratio - a.ratio);
}

export const PAIRING_FILTERS = [
  { id: 'all', label: 'All pairings', test: () => true },
  { id: 'aaNormal', label: 'AA body text', test: (p) => p.wcag.aaNormal, note: '4.5:1 or higher' },
  { id: 'aaLarge', label: 'AA large text', test: (p) => p.wcag.aaLarge, note: '3:1 or higher' },
  { id: 'aaaNormal', label: 'AAA body text', test: (p) => p.wcag.aaaNormal, note: '7:1 or higher' },
  { id: 'ui', label: 'UI components', test: (p) => p.wcag.uiComponent, note: 'Borders, icons, focus rings' },
  { id: 'fail', label: 'Fails everything', test: (p) => !p.wcag.aaLarge, note: 'Decorative use only' },
];

/**
 * The pairing a design actually needs first: the most readable body-text
 * combination in the palette. Used to seed the previews.
 */
export function recommendedSurface(colors, roles) {
  const groups = groupByRole(colors, roles);
  const bgs = groups['light-neutral'].length ? groups['light-neutral'] : colors;
  const texts = groups['dark-neutral'].length ? groups['dark-neutral'] : colors;

  let best = null;
  for (const bg of bgs) {
    for (const text of texts) {
      if (bg === text) continue;
      const ratio = contrastRatio(text, bg);
      if (ratio < 4.5) continue;
      // Prefer the lightest background and the least brutal contrast above AA —
      // maximum contrast is not the same as best-looking.
      const score = hexToOklch(bg).L * 2 - Math.abs(ratio - 9) * 0.05;
      if (!best || score > best.score) best = { bg, text, ratio, score };
    }
  }
  return best || { bg: '#FFFFFF', text: '#111111', ratio: contrastRatio('#111111', '#FFFFFF') };
}
