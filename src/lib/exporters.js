/**
 * exporters.js — getting the palette back out.
 *
 * Exports carry roles, not just hex values. A list of hexes makes you decide
 * everything again in the next tool; `--color-hero` does not.
 */

import { hexToOklch, hexToRgb, formatOklch, contrastRatio } from './color.js';
import { groupByRole } from './roles.js';

function slug(role, index, total) {
  const base = role.replace('-neutral', '');
  if (role === 'hero') return 'hero';
  return total > 1 ? `${base}-${index + 1}` : base;
}

/** Stable, role-based names shared by every text-based export. */
export function namedColors(colors, roles) {
  const groups = groupByRole(colors, roles);
  const named = [];
  for (const [role, list] of Object.entries(groups)) {
    list.forEach((hex, i) => {
      named.push({ hex, role, name: slug(role, i, list.length) });
    });
  }
  return named;
}

export function toCSS(colors, roles, { includeOklch = true } = {}) {
  const named = namedColors(colors, roles);
  const lines = [':root {'];
  for (const { name, hex } of named) {
    lines.push(`  --color-${name}: ${hex.toLowerCase()};`);
  }
  if (includeOklch) {
    lines.push('');
    lines.push('  /* Same colours in OKLCH — lets you derive tints and shades');
    lines.push('     by changing one number without shifting hue. */');
    for (const { name, hex } of named) {
      lines.push(`  --color-${name}-oklch: ${formatOklch(hexToOklch(hex))};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

export function toSCSS(colors, roles) {
  return namedColors(colors, roles)
    .map(({ name, hex }) => `$color-${name}: ${hex.toLowerCase()};`)
    .join('\n');
}

export function toTailwind(colors, roles) {
  const named = namedColors(colors, roles);
  const entries = named
    .map(({ name, hex }) => `        '${name}': '${hex.toLowerCase()}',`)
    .join('\n');
  return `// tailwind.config.js\nexport default {\n  theme: {\n    extend: {\n      colors: {\n${entries}\n      },\n    },\n  },\n};`;
}

export function toJSON(colors, roles, meta = {}) {
  return JSON.stringify(
    {
      name: meta.name || 'Untitled palette',
      generatedBy: 'Palletio',
      generatedAt: new Date().toISOString(),
      colors: namedColors(colors, roles).map(({ hex, name, role }) => {
        const { L, C, h } = hexToOklch(hex);
        const rgb = hexToRgb(hex);
        return {
          name,
          role,
          hex: hex.toLowerCase(),
          rgb: [rgb.r, rgb.g, rgb.b],
          oklch: { l: +(L * 100).toFixed(2), c: +C.toFixed(4), h: +h.toFixed(2) },
        };
      }),
    },
    null,
    2
  );
}

export function toHexList(colors) {
  return colors.map((c) => c.toUpperCase()).join('\n');
}

/* -------------------------------------------------------------- SVG / PNG */

export function toSVG(colors, roles, { width = 1200, height = 630 } = {}) {
  const named = namedColors(colors, roles);
  const cols = Math.min(named.length, 5);
  const rows = Math.ceil(named.length / cols);
  const pad = 48;
  const gap = 16;
  const cellW = (width - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = Math.min(180, (height - pad * 2 - 60 - gap * (rows - 1)) / rows);

  const swatches = named
    .map((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * (cellW + gap);
      const y = pad + 44 + row * (cellH + gap + 42);
      const label = c.role.replace('-', ' ');
      return `  <g>
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH.toFixed(1)}" rx="10" fill="${c.hex}"/>
    <text x="${x.toFixed(1)}" y="${(y + cellH + 20).toFixed(1)}" font-family="ui-monospace, monospace" font-size="14" fill="#1a1a1a">${c.hex}</text>
    <text x="${x.toFixed(1)}" y="${(y + cellH + 37).toFixed(1)}" font-family="system-ui, sans-serif" font-size="12" fill="#8a8a8a">${label}</text>
  </g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${pad}" y="${pad + 16}" font-family="system-ui, sans-serif" font-size="20" font-weight="600" fill="#1a1a1a">Palette</text>
${swatches}
</svg>`;
}

export async function toPNGBlob(colors, roles, options = {}) {
  const svg = toSVG(colors, roles, options);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not render the palette image.'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = (options.width || 1200) * scale;
    canvas.height = (options.height || 630) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------- ASE */

/** Writes an Adobe Swatch Exchange file with RGB blocks and role-based names. */
export function toASEBlob(colors, roles) {
  const named = namedColors(colors, roles);
  const chunks = [];

  const header = new ArrayBuffer(12);
  const hv = new DataView(header);
  'ASEF'.split('').forEach((ch, i) => hv.setUint8(i, ch.charCodeAt(0)));
  hv.setUint16(4, 1);
  hv.setUint16(6, 0);
  hv.setUint32(8, named.length);
  chunks.push(header);

  for (const { name, hex } of named) {
    const label = name + '\0';
    const bodyLength = 2 + label.length * 2 + 4 + 12 + 2;
    const buf = new ArrayBuffer(6 + bodyLength);
    const v = new DataView(buf);
    let p = 0;
    v.setUint16(p, 0x0001); p += 2;
    v.setUint32(p, bodyLength); p += 4;
    v.setUint16(p, label.length); p += 2;
    for (const ch of label) { v.setUint16(p, ch.charCodeAt(0)); p += 2; }
    'RGB '.split('').forEach((ch) => { v.setUint8(p, ch.charCodeAt(0)); p += 1; });
    const { r, g, b } = hexToRgb(hex);
    v.setFloat32(p, r / 255); p += 4;
    v.setFloat32(p, g / 255); p += 4;
    v.setFloat32(p, b / 255); p += 4;
    v.setUint16(p, 0); // global colour type
    chunks.push(buf);
  }

  return new Blob(chunks, { type: 'application/octet-stream' });
}

/* --------------------------------------------------------- report (HTML) */

/**
 * Printable report. Deliberately HTML rather than a generated PDF: the browser's
 * own print-to-PDF gives better type rendering than any client-side PDF library,
 * and it means no 300kB dependency for one button.
 */
export function toReportHTML(colors, roles, pairings, meta = {}) {
  const named = namedColors(colors, roles);
  const passing = pairings.filter((p) => p.wcag.aaNormal).slice(0, 24);

  const swatchRows = named
    .map(
      (c) => `<tr>
      <td><span class="chip" style="background:${c.hex}"></span></td>
      <td class="mono">${c.hex}</td>
      <td>${c.role.replace('-', ' ')}</td>
      <td class="mono">--color-${c.name}</td>
      <td class="mono">${formatOklch(hexToOklch(c.hex))}</td>
    </tr>`
    )
    .join('');

  const pairRows = passing
    .map(
      (p) => `<tr>
      <td><span class="sample" style="background:${p.bg};color:${p.text}">Sample text</span></td>
      <td class="mono">${p.text} on ${p.bg}</td>
      <td class="mono">${p.ratio.toFixed(2)}:1</td>
      <td class="mono">Lc ${Math.round(p.lc)}</td>
      <td>${p.wcag.aaaNormal ? 'AAA' : 'AA'}</td>
    </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${meta.name || 'Palette'} — report</title>
<style>
  body{font:14px/1.55 system-ui,sans-serif;color:#1a1a1a;max-width:920px;margin:40px auto;padding:0 24px}
  h1{font-size:28px;margin:0 0 4px} h2{font-size:16px;margin:36px 0 12px;text-transform:uppercase;letter-spacing:.08em;color:#777}
  table{width:100%;border-collapse:collapse} td,th{text-align:left;padding:8px 10px;border-bottom:1px solid #eee;vertical-align:middle}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#999}
  .mono{font-family:ui-monospace,monospace;font-size:12px}
  .chip{display:block;width:40px;height:28px;border-radius:5px;border:1px solid rgba(0,0,0,.08)}
  .sample{display:inline-block;padding:5px 12px;border-radius:5px;font-size:12px}
  .meta{color:#888;font-size:12px;margin-bottom:8px}
  @media print{body{margin:0}}
</style></head><body>
<h1>${meta.name || 'Untitled palette'}</h1>
<p class="meta">${named.length} colours · ${passing.length} pairings pass AA for body text · exported ${new Date().toLocaleDateString('en-GB')}</p>
<h2>Colours</h2>
<table><thead><tr><th></th><th>Hex</th><th>Role</th><th>Token</th><th>OKLCH</th></tr></thead><tbody>${swatchRows}</tbody></table>
<h2>Accessible pairings</h2>
<table><thead><tr><th>Preview</th><th>Combination</th><th>WCAG</th><th>APCA</th><th>Level</th></tr></thead><tbody>${pairRows}</tbody></table>
</body></html>`;
}

/* ------------------------------------------------------------ share link */

/**
 * Palette lives in the URL hash, so a link works from a static host with no
 * database and no account. Hash rather than query string: it never reaches a
 * server, so a client palette isn't sitting in anyone's access logs.
 */
export function encodeShare(colors, roles, name) {
  const payload = {
    n: name || '',
    c: colors.map((hex) => [hex.replace('#', ''), roleCode(roles[hex])]),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const payload = JSON.parse(json);
    const colors = [];
    const roles = {};
    for (const [hex, code] of payload.c) {
      const full = '#' + hex.toUpperCase();
      colors.push(full);
      roles[full] = codeRole(code);
    }
    return { colors, roles, name: payload.n || '' };
  } catch {
    return null;
  }
}

const ROLE_CODES = { hero: 'h', accent: 'a', 'light-neutral': 'l', 'dark-neutral': 'd' };
const CODE_ROLES = { h: 'hero', a: 'accent', l: 'light-neutral', d: 'dark-neutral' };
const roleCode = (r) => ROLE_CODES[r] || 'a';
const codeRole = (c) => CODE_ROLES[c] || 'accent';

/* ---------------------------------------------------------------- saving */

const STORAGE_KEY = 'palletio.palettes.v1';

export function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function savePalette(entry) {
  const all = loadSaved();
  const idx = all.findIndex((p) => p.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 60)));
  return all;
}

export function deleteSaved(id) {
  const all = loadSaved().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}

/* --------------------------------------------------------------- helpers */

export function download(filename, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export { contrastRatio };
