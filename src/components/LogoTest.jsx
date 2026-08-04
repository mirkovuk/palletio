import { useState, useMemo, useEffect } from 'react';
import {
  MARKS, getMark, TEST_SIZES, markGuidance,
  sanitizeSVG, readViewBox, innerSVG, findFills, recolorSVG,
} from '../lib/logo.js';
import { contrastRatio, simulateCVD, hexToOklch } from '../lib/color.js';
import { surfaceMap } from '../lib/vibes.js';
import { download } from '../lib/exporters.js';
import { IconUpload, IconDownload, IconX, IconWarning } from './Icons.jsx';

/* ------------------------------------------------------------- rendering */

function BuiltInMark({ mark, a, b, size }) {
  return (
    <svg width={size} height={size} viewBox={mark.viewBox} aria-hidden="true">
      {mark.shapes.map((s, i) => {
        const fill = s.slot === 'b' ? b : a;
        if (s.type === 'path') return <path key={i} d={s.d} fill={fill} />;
        if (s.type === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={fill} />;
        return (
          <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} fill={fill} />
        );
      })}
    </svg>
  );
}

function UploadedMark({ upload, mapping, flatten, size }) {
  const html = useMemo(
    () => innerSVG(recolorSVG(upload.svg, mapping, flatten)),
    [upload.svg, mapping, flatten]
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={upload.viewBox}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ------------------------------------------------------------ component */

export default function LogoTest({ colors, roles, cvd }) {
  const [markId, setMarkId] = useState('arc');
  const [upload, setUpload] = useState(null);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const map = surfaceMap(colors, roles);
  const [fg, setFg] = useState(map.hero);
  const [bg, setBg] = useState(map.page);
  const [secondary, setSecondary] = useState(map.ink);

  // If the palette changes underneath a selection, fall back rather than
  // rendering a colour that is no longer in the palette.
  useEffect(() => {
    if (!colors.includes(fg)) setFg(map.hero);
    if (!colors.includes(bg)) setBg(map.page);
    if (!colors.includes(secondary)) setSecondary(map.ink);
  }, [colors]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = getMark(markId);
  const c = (hex) => simulateCVD(hex, cvd);

  const renderMark = (size, aColor, bColor, flatten = null) =>
    upload ? (
      <UploadedMark
        upload={upload}
        mapping={flatten ? {} : mapping}
        flatten={flatten ? c(flatten) : null}
        size={size}
      />
    ) : (
      <BuiltInMark
        mark={mark}
        a={c(flatten || aColor)}
        b={c(flatten || bColor)}
        size={size}
      />
    );

  const handleFile = async (file) => {
    setError('');
    try {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.svg')) {
        throw new Error('Needs to be an SVG. A PNG has no fills to recolour.');
      }
      const text = await file.text();
      const svg = sanitizeSVG(text);
      const fills = findFills(svg);
      setUpload({ name: file.name, svg, viewBox: readViewBox(svg), fills });
      // Seed the mapping so it renders in palette colours immediately rather
      // than in whatever the file happened to contain.
      const seed = {};
      fills.forEach((hex, i) => {
        seed[hex] = i === 0 ? fg : i === 1 ? secondary : colors[i % colors.length];
      });
      setMapping(seed);
    } catch (e) {
      setError(e.message || 'Could not read that file.');
    }
  };

  const pairRatio = contrastRatio(fg, bg);
  const guidance = markGuidance(pairRatio);

  const lightest = [...colors].sort((a, b) => hexToOklch(b).L - hexToOklch(a).L)[0];
  const darkest = [...colors].sort((a, b) => hexToOklch(a).L - hexToOklch(b).L)[0];

  const exportSheet = () => {
    const cell = (markColor, ground, label) => `
      <div class="cell">
        <div class="ground" style="background:${ground}">
          <svg width="64" height="64" viewBox="${upload ? upload.viewBox : mark.viewBox}">
            ${upload
              ? innerSVG(recolorSVG(upload.svg, {}, markColor))
              : mark.shapes.map((s) =>
                  s.type === 'path'
                    ? `<path d="${s.d}" fill="${markColor}"/>`
                    : s.type === 'circle'
                    ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${markColor}"/>`
                    : `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx || 0}" fill="${markColor}"/>`
                ).join('')}
          </svg>
        </div>
        <div class="cap">${label}<br><span>${contrastRatio(markColor, ground).toFixed(2)}:1</span></div>
      </div>`;

    const cells = colors
      .flatMap((ground) => colors.filter((m) => m !== ground).map((m) => cell(m, ground, `${m} on ${ground}`)))
      .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Logo colour tests</title>
<style>
  body{font:13px/1.5 system-ui,sans-serif;margin:40px;color:#1a1a1a}
  h1{font-size:20px} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:16px;margin-top:24px}
  .ground{aspect-ratio:1;display:grid;place-items:center;border-radius:8px;border:1px solid rgba(0,0,0,.08)}
  .cap{font-family:ui-monospace,monospace;font-size:10px;margin-top:6px;color:#666}
  .cap span{color:#999}
</style></head><body>
<h1>Logo colour tests</h1>
<p>${colors.length} colours, ${colors.length * (colors.length - 1)} combinations.</p>
<div class="grid">${cells}</div></body></html>`;

    download('logo-tests.html', html, 'text/html');
  };

  if (colors.length < 2) {
    return <p className="panel-note">Add at least two colours to test a mark.</p>;
  }

  return (
    <div className="col" style={{ gap: 'var(--space-6)' }}>
      {/* ── mark source ─────────────────────────────────────────────── */}
      <div className="row" style={{ gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div className="field">
          <span className="label">Mark</span>
          <div className="vibe-bar">
            {MARKS.map((m) => (
              <button
                key={m.id}
                className="vibe-btn"
                aria-pressed={!upload && markId === m.id}
                onClick={() => { setMarkId(m.id); setUpload(null); }}
              >
                <span className="vibe-btn-label">{m.label}</span>
                <span className="vibe-btn-note">{m.note}</span>
              </button>
            ))}
          </div>
        </div>

        <label
          className="btn"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          style={dragOver ? { borderColor: 'var(--border-focus)' } : undefined}
        >
          <IconUpload /> Upload your SVG
          <input
            type="file"
            accept=".svg,image/svg+xml"
            className="visually-hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </label>

        {upload && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setUpload(null); setMapping({}); }}>
            <IconX /> {upload.name}
          </button>
        )}
      </div>

      {error && <p className="error-note">{error}</p>}

      {/* ── fill mapping for uploaded marks ─────────────────────────── */}
      {upload && (
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div className="panel-head">
            <h4 className="panel-title">
              Fills found in {upload.name}
              <span className="tag">{upload.fills.length}</span>
            </h4>
          </div>
          {upload.fills.length === 0 ? (
            <p className="panel-note">
              No fills in this file — it is probably stroke-based or inherits colour. The
              one-colour tests below will still work; the two-colour ones will not.
            </p>
          ) : (
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              {upload.fills.map((original) => (
                <div className="row" key={original} style={{ gap: 'var(--space-3)' }}>
                  <span className="issue-chip" style={{ background: original }} />
                  <span className="mono" style={{ fontSize: 'var(--text-xs)', width: '9ch' }}>{original}</span>
                  <span style={{ color: 'var(--fg-faint)' }}>→</span>
                  <div className="chip-row">
                    {colors.map((hex) => (
                      <button
                        key={hex}
                        className="chip-pick"
                        onClick={() => setMapping({ ...mapping, [original]: hex })}
                        style={mapping[original] === hex
                          ? { borderColor: 'var(--border-focus)', borderWidth: 2 }
                          : { opacity: 0.55 }}
                        title={hex}
                      >
                        <span className="chip-pick-dot" style={{ background: hex }} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── size ramp for the focused pairing ───────────────────────── */}
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">At size</span>
          <span className="preview-caption-note">
            {fg} on {bg} · {pairRatio.toFixed(2)}:1
            <span className="badge" data-tone={guidance.tone} style={{ marginLeft: 8 }}>{guidance.label}</span>
          </span>
        </div>

        <div
          className="preview-frame"
          style={{ background: c(bg), padding: 'var(--space-6)' }}
        >
          <div className="row" style={{ gap: 'var(--space-8)', alignItems: 'flex-end', justifyContent: 'center' }}>
            {TEST_SIZES.map((s) => (
              <div key={s.px} style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                {renderMark(s.px, fg, secondary)}
                <span
                  className="mono"
                  style={{ fontSize: 10, color: c(fg), opacity: 0.7, textAlign: 'center' }}
                >
                  {s.label}<br />{s.note}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="row" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-4)' }}>
          <div className="field">
            <span className="label">Mark</span>
            <div className="chip-row">
              {colors.map((hex) => (
                <button
                  key={hex}
                  className="chip-pick"
                  onClick={() => setFg(hex)}
                  style={fg === hex ? { borderColor: 'var(--border-focus)', borderWidth: 2 } : { opacity: 0.55 }}
                  title={hex}
                >
                  <span className="chip-pick-dot" style={{ background: hex }} />
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Second colour</span>
            <div className="chip-row">
              {colors.map((hex) => (
                <button
                  key={hex}
                  className="chip-pick"
                  onClick={() => setSecondary(hex)}
                  style={secondary === hex ? { borderColor: 'var(--border-focus)', borderWidth: 2 } : { opacity: 0.55 }}
                  title={hex}
                >
                  <span className="chip-pick-dot" style={{ background: hex }} />
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Background</span>
            <div className="chip-row">
              {colors.map((hex) => (
                <button
                  key={hex}
                  className="chip-pick"
                  onClick={() => setBg(hex)}
                  style={bg === hex ? { borderColor: 'var(--border-focus)', borderWidth: 2 } : { opacity: 0.55 }}
                  title={hex}
                >
                  <span className="chip-pick-dot" style={{ background: hex }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── one-colour reduction ────────────────────────────────────── */}
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">One-colour reduction</span>
          <span className="preview-caption-note">
            The mark in a single colour, both ways round
          </span>
        </div>

        <div className="row" style={{ gap: 'var(--space-4)' }}>
          {[
            { ink: darkest, ground: lightest, label: 'Dark on light' },
            { ink: lightest, ground: darkest, label: 'Light on dark' },
          ].map((v) => (
            <div key={v.label} className="grow" style={{ minWidth: 200 }}>
              <div
                className="preview-frame"
                style={{
                  background: c(v.ground),
                  padding: 'var(--space-6)',
                  display: 'flex',
                  gap: 'var(--space-5)',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                {[64, 32, 16].map((px) => (
                  <div key={px}>{renderMark(px, v.ink, v.ink, v.ink)}</div>
                ))}
              </div>
              <p className="panel-note" style={{ marginTop: 'var(--space-2)' }}>
                {v.label} · <span className="mono">{v.ink} on {v.ground}</span> ·{' '}
                {contrastRatio(v.ink, v.ground).toFixed(2)}:1
              </p>
            </div>
          ))}
        </div>

        <p className="panel-note" style={{ marginTop: 'var(--space-2)' }}>
          If the mark loses structure here, it is carrying meaning in colour that the form should be
          carrying. That shows up on faxes, embroidery, engraving, single-colour print and anywhere
          the logo is used as a mask — all the places you cannot control.
        </p>
      </div>

      {/* ── full combination matrix ─────────────────────────────────── */}
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">Every combination</span>
          <span className="preview-caption-note">
            {colors.length * (colors.length - 1)} pairs — click one to load it above
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(96px, 1fr))`,
            gap: 'var(--space-2)',
          }}
        >
          {colors.flatMap((ground) =>
            colors
              .filter((markColor) => markColor !== ground)
              .map((markColor) => {
                const ratio = contrastRatio(markColor, ground);
                const g = markGuidance(ratio);
                return (
                  <button
                    key={`${markColor}-${ground}`}
                    onClick={() => { setFg(markColor); setBg(ground); }}
                    title={`${markColor} on ${ground} — ${ratio.toFixed(2)}:1`}
                    style={{
                      background: c(ground),
                      border: '1px solid rgba(128,128,128,0.2)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-3)',
                      display: 'grid',
                      justifyItems: 'center',
                      gap: 4,
                      opacity: fg === markColor && bg === ground ? 1 : 0.92,
                      outline: fg === markColor && bg === ground ? '2px solid var(--border-focus)' : 'none',
                      outlineOffset: 2,
                    }}
                  >
                    {renderMark(40, markColor, markColor, markColor)}
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        color: c(markColor),
                        opacity: 0.85,
                      }}
                    >
                      {ratio.toFixed(1)}
                    </span>
                    {g.tone === 'bad' && (
                      <span style={{ fontSize: 9, color: c(markColor), opacity: 0.7 }}>
                        <IconWarning width={9} height={9} />
                      </span>
                    )}
                  </button>
                );
              })
          )}
        </div>
      </div>

      <div className="row">
        <button className="btn btn-sm" onClick={exportSheet}>
          <IconDownload /> Download the test sheet
        </button>
        <p className="panel-note" style={{ margin: 0 }}>
          A printable page of every combination — useful in a brand guidelines appendix.
        </p>
      </div>

      <div className="panel" style={{ background: 'var(--bg-subtle)' }}>
        <p className="issue-detail" style={{ margin: 0 }}>
          <strong>On the numbers here:</strong> WCAG explicitly exempts logotypes, so a mark has no
          legal contrast requirement. That does not make the ratios useless — below about 3:1 a mark
          stops holding its shape at small sizes and in poor viewing conditions. Treat these as
          legibility guidance, not compliance.
        </p>
      </div>
    </div>
  );
}
