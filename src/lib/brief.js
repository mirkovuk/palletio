/**
 * brief.js — brand brief in, starting palette out.
 *
 * Two ways to reach the model, both configured in Settings:
 *
 *   Worker (recommended) — your Cloudflare Worker holds the key server-side.
 *   Nothing sensitive touches the browser. See /worker in this repo.
 *
 *   Direct key — the browser calls Anthropic with a key you paste in. It is
 *   stored in localStorage and never leaves your machine except to Anthropic,
 *   but anyone with access to your browser can read it. Fine for personal use
 *   on your own machine; not fine for a link you send a client.
 *
 * Either way the model only ever proposes hex values, which are then run
 * through the same harmony and contrast engine as anything you enter by hand.
 * The maths is not delegated.
 */

import { normalizeHex } from './color.js';

const SYSTEM_PROMPT = `You are a colour specialist working with an experienced art director. Given a brand brief, propose a working colour palette.

Return ONLY a JSON object, no prose, no markdown fences, in this exact shape:
{
  "rationale": "two sentences on the thinking, written plainly, no marketing language",
  "colors": [
    { "hex": "#RRGGBB", "role": "hero|accent|light-neutral|dark-neutral", "name": "short descriptive name", "note": "one clause on what this colour is for" }
  ]
}

Rules for the palette:
- 6 to 8 colours total.
- Exactly one hero.
- At least one light neutral above 90% perceptual lightness, and at least one dark neutral below 30%. Tint both towards the palette's dominant hue rather than using pure grey.
- Avoid the obvious literal choice for the sector. Green for sustainability and blue for finance are where a brief goes to die.
- Ensure the dark neutral reaches at least 4.5:1 against the light neutral.
- Do not use pure #000000 or #FFFFFF.`;

function parseResponse(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The model did not return a palette.');

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const colors = [];
  const roles = {};
  const notes = {};

  for (const entry of parsed.colors || []) {
    const hex = normalizeHex(entry.hex);
    if (!hex || colors.includes(hex)) continue;
    colors.push(hex);
    roles[hex] = ['hero', 'accent', 'light-neutral', 'dark-neutral'].includes(entry.role)
      ? entry.role
      : 'accent';
    notes[hex] = entry.note || entry.name || '';
  }

  if (!colors.length) throw new Error('No usable colours came back. Try rephrasing the brief.');
  return { colors, roles, notes, rationale: parsed.rationale || '' };
}

export async function generateFromBrief(brief, config) {
  const userPrompt = `Brand brief:\n\n${brief.trim()}`;

  if (config.mode === 'worker') {
    if (!config.workerUrl) throw new Error('No worker address set. Add one in Settings.');
    const res = await fetch(`${config.workerUrl.replace(/\/$/, '')}/palette`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: SYSTEM_PROMPT, prompt: userPrompt }),
    });
    if (!res.ok) throw new Error(`Worker returned ${res.status}.`);
    const data = await res.json();
    return parseResponse(data.text || '');
  }

  if (!config.apiKey) throw new Error('No API key set. Add one in Settings, or switch to worker mode.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API returned ${res.status}. ${detail.slice(0, 160)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseResponse(text);
}

/* ------------------------------------------------------------- settings */

const KEY = 'palletio.settings.v1';

export const defaultSettings = {
  mode: 'none', // 'none' | 'worker' | 'direct'
  workerUrl: '',
  apiKey: '',
  model: 'claude-sonnet-4-6',
  proxyUrl: '',
};

export function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  return settings;
}
