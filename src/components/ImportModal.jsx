import { useState } from 'react';
import { normalizeHex } from '../lib/color.js';
import {
  extractFromImage, extractFromText, importPaletteFile, extractFromURL,
} from '../lib/extract.js';
import { generateFromBrief } from '../lib/brief.js';
import { IconX, IconCheck, IconSparkle } from './Icons.jsx';

const TABS = [
  { id: 'hex', label: 'Hex codes' },
  { id: 'image', label: 'Image' },
  { id: 'css', label: 'Paste source' },
  { id: 'url', label: 'Website' },
  { id: 'file', label: 'Palette file' },
  { id: 'brief', label: 'Brand brief' },
];

export default function ImportModal({ onClose, onImport, settings, onToast }) {
  const [tab, setTab] = useState('hex');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rationale, setRationale] = useState('');

  const [hexInput, setHexInput] = useState('');
  const [cssInput, setCssInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [briefInput, setBriefInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const present = (hexes, note = '') => {
    const unique = [...new Set(hexes.filter(Boolean))];
    setCandidates(unique);
    setSelected(new Set(unique));
    setRationale(note);
    if (!unique.length) setError('No colours found. Try a different source.');
  };

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setRationale('');
    try { await fn(); }
    catch (e) { setError(e.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  const toggle = (hex) => {
    const next = new Set(selected);
    next.has(hex) ? next.delete(hex) : next.add(hex);
    setSelected(next);
  };

  const confirm = () => {
    const list = candidates.filter((c) => selected.has(c));
    if (list.length) onImport(list);
  };

  const handleImageFile = (file) =>
    run(async () => {
      if (!file || !file.type.startsWith('image/')) throw new Error('That is not an image file.');
      present(await extractFromImage(file, 8), 'Ordered by how much of the image each colour covers.');
    });

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Import colours">
        <div className="modal-head">
          <h2 className="modal-title">Import colours</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tab"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setCandidates([]); setError(''); setRationale(''); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'hex' && (
          <div className="col">
            <div className="field">
              <label className="label" htmlFor="hexes">Hex codes</label>
              <textarea
                id="hexes"
                className="textarea input-mono"
                placeholder="#FFC5B9&#10;#2A1F1A&#10;#E7E6A9"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
              />
            </div>
            <p className="panel-note">Separate with new lines, commas or spaces. The # is optional.</p>
            <button
              className="btn btn-primary"
              onClick={() => present(
                hexInput.split(/[\s,;]+/).map(normalizeHex).filter(Boolean)
              )}
            >
              Find colours
            </button>
          </div>
        )}

        {tab === 'image' && (
          <div className="col">
            <div
              className="dropzone"
              data-over={dragOver || undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleImageFile(e.dataTransfer.files[0]);
              }}
            >
              Drop an image here, or
              <label className="btn btn-sm" style={{ marginLeft: 8 }}>
                choose a file
                <input
                  type="file"
                  accept="image/*"
                  className="visually-hidden"
                  onChange={(e) => handleImageFile(e.target.files[0])}
                />
              </label>
            </div>
            <p className="panel-note">
              Colours are clustered perceptually rather than by RGB value, so what comes back matches
              what the eye picks out of the image. A screenshot of a website works well here.
            </p>
          </div>
        )}

        {tab === 'css' && (
          <div className="col">
            <div className="field">
              <label className="label" htmlFor="css">CSS, HTML or anything containing colours</label>
              <textarea
                id="css"
                className="textarea mono"
                placeholder="Paste a stylesheet, a view-source dump, a Figma export…"
                value={cssInput}
                onChange={(e) => setCssInput(e.target.value)}
              />
            </div>
            <p className="panel-note">
              Hex, rgb() and hsl() are all recognised, ranked by how often each appears.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => present(
                extractFromText(cssInput, 16).map((x) => x.hex),
                'Ordered by how often each colour appears in the source.'
              )}
            >
              Find colours
            </button>
          </div>
        )}

        {tab === 'url' && (
          <div className="col">
            {!settings.proxyUrl ? (
              <>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <span className="badge" data-tone="warn">Not set up</span>
                  <span className="panel-note" style={{ margin: 0 }}>
                    This tab needs a proxy before it can do anything.
                  </span>
                </div>

                <p className="issue-detail">
                  A browser is not allowed to read another website's code. That is a security rule
                  built into every browser, not something this tool can code around — so reading
                  colours off a live URL needs a small server in between. There are three ways
                  forward, and two of them need nothing at all:
                </p>

                <ol style={{ margin: 0, paddingLeft: 'var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
                  <li className="issue-detail" style={{ margin: 0 }}>
                    <strong>Screenshot the site</strong> and drop it into the Image tab. Colours are
                    clustered perceptually, so what comes back is what your eye picks out. Works
                    right now, no setup.
                  </li>
                  <li className="issue-detail" style={{ margin: 0 }}>
                    <strong>View source and paste it</strong> into the Paste Source tab. Catches
                    every hex, rgb() and hsl() and ranks them by how often they appear — often more
                    accurate than a screenshot, because it finds colours not currently on screen.
                  </li>
                  <li className="issue-detail" style={{ margin: 0 }}>
                    <strong>Deploy the worker</strong> in the <span className="mono">worker/</span>{' '}
                    folder of this project. Roughly five minutes: install wrangler, run{' '}
                    <span className="mono">wrangler deploy</span>, paste the address it gives you
                    into Settings. Then this tab works, and it follows stylesheets too.
                  </li>
                </ol>

                <div className="row">
                  <button className="btn" onClick={() => { setTab('image'); setCandidates([]); }}>
                    Use a screenshot instead
                  </button>
                  <button className="btn" onClick={() => { setTab('css'); setCandidates([]); }}>
                    Paste source instead
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label className="label" htmlFor="url">Website address</label>
                  <input
                    id="url"
                    className="input"
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                </div>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <span className="badge" data-tone="good">Proxy connected</span>
                  <span className="panel-note mono" style={{ margin: 0, fontSize: 'var(--text-2xs)' }}>
                    {settings.proxyUrl}
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={busy || !urlInput.trim()}
                  onClick={() => run(async () => {
                    const found = await extractFromURL(urlInput, settings.proxyUrl);
                    present(found.map((x) => x.hex), 'Ordered by how often each colour appears in the page and its stylesheets.');
                  })}
                >
                  {busy ? 'Fetching…' : 'Fetch colours'}
                </button>
                <p className="panel-note">
                  Reads the page and up to five of its stylesheets. Colours loaded by JavaScript
                  after the page renders will not appear — for those, a screenshot is more reliable.
                </p>
              </>
            )}
          </div>
        )}

        {tab === 'file' && (
          <div className="col">
            <div
              className="dropzone"
              data-over={dragOver || undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                run(async () => present(await importPaletteFile(e.dataTransfer.files[0])));
              }}
            >
              Drop a palette file, or
              <label className="btn btn-sm" style={{ marginLeft: 8 }}>
                choose a file
                <input
                  type="file"
                  accept=".ase,.json,.gpl,.csv,.txt,.css,.scss"
                  className="visually-hidden"
                  onChange={(e) => run(async () => present(await importPaletteFile(e.target.files[0])))}
                />
              </label>
            </div>
            <p className="panel-note">
              Adobe Swatch Exchange (.ase), GIMP (.gpl), JSON, CSV and plain text. Design tokens in
              JSON are read at any nesting depth.
            </p>
          </div>
        )}

        {tab === 'brief' && (
          <div className="col">
            <div className="field">
              <label className="label" htmlFor="brief">Describe the brand</label>
              <textarea
                id="brief"
                className="textarea"
                placeholder="A lighting design studio in Patagonia. Precise, technical, quietly warm. Their work is about how light behaves in very particular weather."
                value={briefInput}
                onChange={(e) => setBriefInput(e.target.value)}
                style={{ minHeight: 128 }}
              />
            </div>
            {settings.mode === 'none' ? (
              <p className="error-note">
                No model connection set up yet. Open Settings and add either a worker address or an
                API key — the worker route keeps the key off this machine.
              </p>
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy || !briefInput.trim()}
                onClick={() => run(async () => {
                  const result = await generateFromBrief(briefInput, settings);
                  present(result.colors, result.rationale);
                })}
              >
                <IconSparkle /> {busy ? 'Thinking…' : 'Propose a palette'}
              </button>
            )}
            <p className="panel-note">
              Whatever comes back is a starting point, not an answer — it goes through the same
              harmony and contrast checks as anything you enter by hand.
            </p>
          </div>
        )}

        {error && <p className="error-note">{error}</p>}

        {candidates.length > 0 && (
          <div className="col">
            {rationale && <p className="panel-note">{rationale}</p>}
            <div className="label">Found {candidates.length} — tap to include or exclude</div>
            <div className="chip-row">
              {candidates.map((hex) => (
                <button
                  key={hex}
                  className="chip-pick"
                  onClick={() => toggle(hex)}
                  style={{ opacity: selected.has(hex) ? 1 : 0.4 }}
                >
                  <span className="chip-pick-dot" style={{ background: hex }} />
                  {hex}
                  {selected.has(hex) && <IconCheck />}
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn btn-primary" onClick={confirm} disabled={!selected.size}>
                Add {selected.size} {selected.size === 1 ? 'colour' : 'colours'}
              </button>
              <button className="btn" onClick={() => setSelected(new Set(candidates))}>Select all</button>
              <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
