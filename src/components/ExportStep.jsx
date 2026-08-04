import { useState } from 'react';
import Previews from './Previews.jsx';
import LogoTest from './LogoTest.jsx';
import { VIBES } from '../lib/vibes.js';
import { findImages, TREATMENTS, VIBE_QUERIES } from '../lib/imagery.js';
import { surfaceMap } from '../lib/vibes.js';
import { CVD_TYPES } from '../lib/color.js';
import { buildPairings } from '../lib/roles.js';
import {
  toCSS, toSCSS, toTailwind, toJSON, toHexList, toSVG, toPNGBlob,
  toASEBlob, toReportHTML, download, copyText, encodeShare,
} from '../lib/exporters.js';
import { IconDownload, IconCopy, IconLink, IconSave, IconImage, IconShuffle, IconX } from './Icons.jsx';

const CODE_TABS = [
  { id: 'css', label: 'CSS variables', build: toCSS },
  { id: 'scss', label: 'SCSS', build: toSCSS },
  { id: 'tailwind', label: 'Tailwind', build: toTailwind },
  { id: 'json', label: 'JSON', build: toJSON },
];

export default function ExportStep({
  colors, roles, name, vibeId, onVibeChange, cvd, onCvdChange, onToast, onSave, settings,
  logoState, onLogoState, imageState, onImageState,
}) {
  const [codeTab, setCodeTab] = useState('css');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  /* Imagery state is held by the parent so a chosen photograph survives
     navigating away and back. Only the transient bits — loading, errors —
     are local. */
  const setImage = (next) => onImageState((prev) => ({ ...prev, ...next }));
  const { on: imageOn, images, selected, treatment, strength, source } = imageState;

  const map = surfaceMap(colors, roles);
  const hero = colors.find((hex) => roles[hex] === 'hero') || colors[0];

  /* Duotone endpoints default to the palette's text and page colours — the
     darkest and lightest things you actually chose — and can be overridden. */
  const shadow = colors.includes(imageState.shadow) ? imageState.shadow : map.ink;
  const highlight = colors.includes(imageState.highlight) ? imageState.highlight : map.page;
  const previewMap = { ...map, duotoneShadow: shadow, duotoneHighlight: highlight };

  const loadImages = async () => {
    setImageBusy(true);
    setImageError('');
    try {
      const result = await findImages({
        query: VIBE_QUERIES[vibeId] || 'abstract texture',
        hero,
        settings,
      });
      setImage({
        images: result.images,
        source: result.source,
        selected: result.images[0] || null,
        on: true,
      });
    } catch (e) {
      setImageError(e.message || 'Could not load imagery.');
    } finally {
      setImageBusy(false);
    }
  };

  const slug = (name || 'palette').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'palette';
  const code = (CODE_TABS.find((t) => t.id === codeTab) || CODE_TABS[0]).build(colors, roles, { name });

  const files = [
    {
      label: 'Report',
      note: 'Printable page with swatches, tokens and every passing pairing',
      run: () => download(`${slug}-report.html`, toReportHTML(colors, roles, buildPairings(colors), { name }), 'text/html'),
    },
    {
      label: 'SVG',
      note: 'Vector sheet — opens in Illustrator, Figma, anywhere',
      run: () => download(`${slug}.svg`, toSVG(colors, roles), 'image/svg+xml'),
    },
    {
      label: 'PNG',
      note: '2400 × 1260 preview image for decks and messages',
      run: async () => download(`${slug}.png`, await toPNGBlob(colors, roles)),
    },
    {
      label: 'Adobe Swatch Exchange',
      note: '.ase with role names — loads into Illustrator, InDesign, Photoshop',
      run: () => download(`${slug}.ase`, toASEBlob(colors, roles)),
    },
    {
      label: 'JSON',
      note: 'Hex, RGB and OKLCH per colour, with roles',
      run: () => download(`${slug}.json`, toJSON(colors, roles, { name }), 'application/json'),
    },
  ];

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#p=${encodeShare(colors, roles, name)}`;
    const ok = await copyText(url);
    onToast(ok ? 'Link copied — the palette travels inside it' : 'Could not reach the clipboard');
  };

  return (
    <>
      <div className="step-head">
        <h2 className="step-title">Use it</h2>
        <p className="step-sub">
          The same palette in five typographic contexts, then every format you might need it in.
          If it only works in one of the samples below, it is not finished.
        </p>
      </div>

      <div className="panel">
        <div className="preview-controls">
          <div className="field">
            <span className="label">Direction</span>
            <div className="vibe-bar">
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  className="vibe-btn"
                  aria-pressed={vibeId === v.id}
                  onClick={() => onVibeChange(v.id)}
                >
                  <span className="vibe-btn-label">{v.label}</span>
                  <span className="vibe-btn-note">{v.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="preview-cvd">Colour vision</label>
            <select
              id="preview-cvd"
              className="select"
              value={cvd}
              onChange={(e) => onCvdChange(e.target.value)}
              style={{ width: 200 }}
            >
              {CVD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="image-picker" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="row">
            {!imageOn ? (
              <button className="btn btn-sm" onClick={loadImages} disabled={imageBusy}>
                <IconImage /> {imageBusy ? 'Finding images…' : 'Preview with tone-minded imagery'}
              </button>
            ) : (
              <>
                <button className="btn btn-sm" onClick={() => setImage({ on: false })}>
                  <IconX /> Remove imagery
                </button>
                <button className="btn btn-sm" onClick={loadImages} disabled={imageBusy}>
                  <IconShuffle /> Different images
                </button>
                <div className="filter-bar">
                  {TREATMENTS.map((t) => (
                    <button
                      key={t.id}
                      className="filter-btn"
                      aria-pressed={treatment === t.id}
                      onClick={() => setImage({ treatment: t.id })}
                      title={t.note}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {imageError && <p className="error-note">{imageError}</p>}

          {imageOn && images.length > 0 && (
            <>
              <div className="image-thumbs">
                {images.map((img) => (
                  <button
                    key={img.id}
                    className="image-thumb"
                    aria-pressed={selected?.id === img.id}
                    onClick={() => setImage({ selected: img })}
                  >
                    <img src={img.thumb} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 'var(--space-6)', alignItems: 'flex-start' }}>
                <div className="logo-size-control" style={{ minWidth: 200, flex: 1 }}>
                  <div className="picker-row-label">
                    <span className="label">Blend</span>
                    <span className="picker-value mono">{Math.round(strength * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="logo-size-slider"
                    min="0" max="100" step="5"
                    value={Math.round(strength * 100)}
                    onChange={(e) => setImage({ strength: +e.target.value / 100 })}
                    aria-label="Treatment strength"
                  />
                  <p className="panel-note" style={{ margin: 0 }}>
                    How far the treatment goes. Below 100% some of the original photograph survives,
                    which usually sits more naturally in a layout than a hard duotone.
                  </p>
                </div>

                {treatment === 'duotone' && (
                  <>
                    <div className="field">
                      <span className="label">Shadows</span>
                      <div className="chip-row">
                        {colors.map((hex) => (
                          <button
                            key={hex} className="chip-pick" title={hex}
                            onClick={() => setImage({ shadow: hex })}
                            style={shadow === hex
                              ? { borderColor: 'var(--border-focus)', borderWidth: 2 }
                              : { opacity: 0.55 }}
                          >
                            <span className="chip-pick-dot" style={{ background: hex }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <span className="label">Highlights</span>
                      <div className="chip-row">
                        {colors.map((hex) => (
                          <button
                            key={hex} className="chip-pick" title={hex}
                            onClick={() => setImage({ highlight: hex })}
                            style={highlight === hex
                              ? { borderColor: 'var(--border-focus)', borderWidth: 2 }
                              : { opacity: 0.55 }}
                          >
                            <span className="chip-pick-dot" style={{ background: hex }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <p className="panel-note">
                {TREATMENTS.find((t) => t.id === treatment)?.note}
                {treatment === 'duotone' && ` · Currently mapping shadows to ${shadow} and highlights to ${highlight}.`}
                {source === 'picsum' && ' · Using Lorem Picsum, which needs no key but ignores the subject. Add an Unsplash access key in Settings for images matched to your palette and vibe.'}
                {source === 'unsplash' && ' · Photographs from Unsplash, filtered towards your hero colour.'}
              </p>
            </>
          )}
        </div>

        <Previews
          colors={colors}
          roles={roles}
          vibeId={vibeId}
          onVibeChange={onVibeChange}
          cvd={cvd}
          onCvdChange={onCvdChange}
          image={imageOn ? selected : null}
          treatment={treatment}
          imageStrength={strength}
          overrideMap={previewMap}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Logo test</h3>
          <p className="panel-note">
            Upload a real mark, or use one of the built-ins to feel out the palette
          </p>
        </div>
        <LogoTest
          colors={colors}
          roles={roles}
          cvd={cvd}
          state={logoState}
          onState={onLogoState}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Code</h3>
          <div className="row">
            <button className="btn btn-sm" onClick={async () => {
              const ok = await copyText(code);
              onToast(ok ? 'Copied' : 'Could not reach the clipboard');
            }}>
              <IconCopy /> Copy
            </button>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
          {CODE_TABS.map((t) => (
            <button
              key={t.id}
              className="tab"
              role="tab"
              aria-selected={codeTab === t.id}
              onClick={() => setCodeTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <pre className="code-block">{code}</pre>
        <p className="panel-note" style={{ marginTop: 'var(--space-3)' }}>
          Names come from roles, not from position, so re-ordering the palette never breaks a
          stylesheet that already uses these tokens.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Files</h3>
        </div>
        <div className="export-list">
          {files.map((f) => (
            <div className="export-row" key={f.label}>
              <div>
                <div className="export-row-title">{f.label}</div>
                <div className="export-row-note">{f.note}</div>
              </div>
              <button className="btn btn-sm" onClick={f.run}><IconDownload /> Download</button>
            </div>
          ))}

          <div className="export-row">
            <div>
              <div className="export-row-title">Copy hex list</div>
              <div className="export-row-note">Plain list, one per line</div>
            </div>
            <button className="btn btn-sm" onClick={async () => {
              const ok = await copyText(toHexList(colors));
              onToast(ok ? 'Copied' : 'Could not reach the clipboard');
            }}>
              <IconCopy /> Copy
            </button>
          </div>

          <div className="export-row">
            <div>
              <div className="export-row-title">Share link</div>
              <div className="export-row-note">
                The whole palette is encoded in the URL — no account, no server, nothing stored
              </div>
            </div>
            <button className="btn btn-sm" onClick={share}><IconLink /> Copy link</button>
          </div>

          <div className="export-row">
            <div>
              <div className="export-row-title">Save to this browser</div>
              <div className="export-row-note">Kept locally so you can come back to it</div>
            </div>
            <button className="btn btn-sm" onClick={onSave}><IconSave /> Save</button>
          </div>
        </div>
      </div>
    </>
  );
}
