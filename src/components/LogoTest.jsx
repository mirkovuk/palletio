import { useState, useMemo, useEffect, useRef } from 'react';
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

/* The smallest the large preview goes is one step above the 96px ramp below
   it, so the two never show the same thing twice. */
const LARGE_MIN = 156;

/**
 * Suitability tiers for a mark on a ground.
 *
 * Not WCAG levels — WCAG exempts logotypes entirely. These are thresholds for
 * whether the mark holds its shape, which is a different question from text
 * legibility and has a lower floor.
 */
const TIERS = [
  { id: 'best', mark: '★', label: 'Use these', range: '4.5:1 and above', min: 4.5,
    note: 'Holds at every size, down to favicon. Safe as a default lockup.' },
  { id: 'ok', mark: '✓', label: 'Usable with care', range: '3:1 to 4.5:1', min: 3,
    note: 'Fine above roughly 32px. Avoid for anything small or fine-lined.' },
  { id: 'weak', mark: '~', label: 'Large only', range: '2:1 to 3:1', min: 2,
    note: 'Works as a big graphic element. Loses definition as soon as it shrinks.' },
  { id: 'avoid', mark: '✕', label: 'Avoid', range: 'Below 2:1', min: 0,
    note: 'Mark and ground are too close to separate reliably.' },
];

function tierFor(ratio) {
  return TIERS.find((t) => ratio >= t.min) || TIERS[TIERS.length - 1];
}

/* ------------------------------------------------------------ component */

export default function LogoTest({ colors, roles, cvd, state, onState }) {
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const map = surfaceMap(colors, roles);

  /* All of this lives in the parent so it survives navigating between steps.
     An uploaded logo that vanishes when you go back to tweak a colour makes
     the whole test useless. */
  const patch = (next) => onState((prev) => ({ ...prev, ...next }));

  const markId = state.markId;
  const upload = state.upload;
  const mapping = state.mapping;
  const grouped = state.grouped;

  /* Colour choices fall back to sensible roles when unset, or when the
     palette changes underneath them. */
  const fg = colors.includes(state.fg) ? state.fg : map.hero;
  const bg = colors.includes(state.bg) ? state.bg : map.page;
  const secondary = colors.includes(state.secondary) ? state.secondary : map.ink;

  const setMarkId = (markId) => patch({ markId, upload: null });
  const setUpload = (upload) => patch({ upload });
  const setMapping = (mapping) => patch({ mapping });
  const setGrouped = (grouped) => patch({ grouped });
  const setFg = (fg) => patch({ fg });
  const setBg = (bg) => patch({ bg });
  const setSecondary = (secondary) => patch({ secondary });

  const mark = getMark(markId);
  const c = (hex) => simulateCVD(hex, cvd);

  /* The large preview is bounded by its own container rather than a fixed
     number, so it fills the space available without ever overflowing it. */
  const stageRef = useRef(null);
  const [largeMax, setLargeMax] = useState(360);
  const largeSize = state.largeSize;
  const setLargeSize = (largeSize) => patch({ largeSize });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const available = Math.floor(
        Math.min(entry.contentRect.width, window.innerHeight * 0.55)
      );
      const ceiling = Math.max(LARGE_MIN, available);
      setLargeMax(ceiling);
      onState((prev) => (prev.largeSize > ceiling ? { ...prev, largeSize: ceiling } : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onState]);

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
      // Seed the mapping so it renders in palette colours immediately rather
      // than in whatever the file happened to contain.
      const seed = {};
      fills.forEach((hex, i) => {
        seed[hex] = i === 0 ? fg : i === 1 ? secondary : colors[i % colors.length];
      });
      patch({ upload: { name: file.name, svg, viewBox: readViewBox(svg), fills }, mapping: seed });
    } catch (e) {
      setError(e.message || 'Could not read that file.');
    }
  };

  const pairRatio = contrastRatio(fg, bg);
  const guidance = markGuidance(pairRatio);

  /* Computed once so switching grouping never recalculates contrast. */
  const combos = useMemo(() => {
    const out = [];
    for (const ground of colors) {
      for (const markColor of colors) {
        if (markColor === ground) continue;
        const ratio = contrastRatio(markColor, ground);
        out.push({ markColor, ground, ratio, tier: tierFor(ratio).id });
      }
    }
    return out.sort((a, b) => b.ratio - a.ratio);
  }, [colors]);

  /* The recommended tier is drawn half again as large. These are the pairs
     you will actually pick from, so they get the space to be judged rather
     than merely counted. */
  const renderTile = ({ markColor, ground, ratio }, large = false) => {
    const tier = tierFor(ratio);
    return (
      <button
        key={`${markColor}-${ground}`}
        className="combo-tile"
        data-selected={(fg === markColor && bg === ground) || undefined}
        onClick={() => { setFg(markColor); setBg(ground); }}
        title={`${markColor} on ${ground} — ${ratio.toFixed(2)}:1 · ${tier.label}`}
        style={{ background: c(ground) }}
      >
        <span className="combo-mark" style={{ color: c(markColor) }}>{tier.mark}</span>
        {renderMark(large ? 60 : 40, markColor, markColor, markColor)}
        <span className="combo-ratio" style={{ color: c(markColor) }}>{ratio.toFixed(1)}</span>
      </button>
    );
  };

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
                onClick={() => setMarkId(m.id)}
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
          <button className="btn btn-ghost btn-sm" onClick={() => patch({ upload: null, mapping: {} })}>
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

      {/* ── large stage, then the small-size ramp ───────────────────── */}
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">At size</span>
          <span className="preview-caption-note">
            {fg} on {bg} · {pairRatio.toFixed(2)}:1
            <span className="badge" data-tone={guidance.tone} style={{ marginLeft: 8 }}>{guidance.label}</span>
          </span>
        </div>

        <div
          className="preview-frame logo-stage"
          ref={stageRef}
          style={{ background: c(bg) }}
        >
          {renderMark(largeSize, fg, secondary)}
        </div>

        <div className="logo-size-control" style={{ marginTop: 'var(--space-3)' }}>
          <div className="picker-row-label">
            <span className="label">Large preview</span>
            <span className="picker-value mono">{largeSize}px</span>
          </div>
          <input
            type="range"
            className="logo-size-slider"
            min={LARGE_MIN}
            max={largeMax}
            step={4}
            value={largeSize}
            onChange={(e) => setLargeSize(+e.target.value)}
            aria-label="Large preview size"
          />
          <p className="panel-note">
            Ranges from {LARGE_MIN}px up to whatever the frame can hold ({largeMax}px here) — the
            ceiling follows the window, so the mark never breaks out of its container.
          </p>
        </div>

        <div
          className="preview-frame logo-ramp"
          style={{ background: c(bg), marginTop: 'var(--space-4)' }}
        >
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
                {/* Two sizes, not three. The third was small enough that a
                    wordmark turned to grey mush, which tells you nothing
                    about the colour pair — the small-size question is
                    already answered by the ramp above. */}
                {[104, 52].map((px) => (
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

      {/* ── full combination matrix, grouped by suitability ─────────── */}
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">Every combination</span>
          <span className="preview-caption-note">
            {combos.length} pairs — click one to load it above
          </span>
        </div>

        <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="filter-bar">
            <button className="filter-btn" aria-pressed={grouped} onClick={() => setGrouped(true)}>
              Grouped by suitability
            </button>
            <button className="filter-btn" aria-pressed={!grouped} onClick={() => setGrouped(false)}>
              By contrast
            </button>
          </div>
        </div>

        {grouped ? (
          <div className="combo-groups">
            {TIERS.map((tier) => {
              const items = combos.filter((x) => x.tier === tier.id);
              if (!items.length) return null;
              return (
                <div key={tier.id}>
                  <div className="combo-group-head">
                    <span>{tier.mark} {tier.label}</span>
                    <span className="mono">{items.length}</span>
                  </div>
                  <p className="panel-note" style={{ marginBottom: 'var(--space-3)' }}>{tier.note}</p>
                  <div className="combo-grid" data-scale={tier.id === 'best' ? 'large' : undefined}>
                    {items.map((item) => renderTile(item, tier.id === 'best'))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="combo-grid">{combos.map((item) => renderTile(item))}</div>
        )}

        <div className="combo-legend" style={{ marginTop: 'var(--space-4)' }}>
          {TIERS.map((t) => (
            <span key={t.id}>{t.mark} {t.label} — {t.range}</span>
          ))}
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
