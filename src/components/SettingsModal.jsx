import { useState } from 'react';
import { saveSettings } from '../lib/brief.js';
import { loadSaved, deleteSaved } from '../lib/exporters.js';
import { IconX, IconTrash } from './Icons.jsx';

export default function SettingsModal({ settings, onChange, onClose, onLoadPalette, onToast }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(loadSaved());

  const commit = () => {
    saveSettings(draft);
    onChange(draft);
    onToast('Settings saved');
    onClose();
  };

  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Settings">
        <div className="modal-head">
          <h2 className="modal-title">Settings</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="col">
          <div className="field">
            <label className="label" htmlFor="proxy">Proxy address — for reading colours off a live site</label>
            <input
              id="proxy"
              className="input mono"
              placeholder="https://palletio-proxy.your-name.workers.dev"
              value={draft.proxyUrl}
              onChange={set('proxyUrl')}
            />
          </div>
          <p className="panel-note">
            A browser cannot fetch another website directly. The <code>worker/</code> folder in this
            repository deploys to Cloudflare in a couple of minutes and does exactly this one job.
            Leave it empty and the Website tab stays off — everything else works regardless.
          </p>
        </div>

        <div className="col">
          <div className="field">
            <span className="label">Brand brief connection</span>
            <div className="filter-bar">
              {[
                { id: 'none', label: 'Off' },
                { id: 'worker', label: 'Via worker' },
                { id: 'direct', label: 'Direct key' },
              ].map((m) => (
                <button
                  key={m.id}
                  className="filter-btn"
                  aria-pressed={draft.mode === m.id}
                  onClick={() => setDraft({ ...draft, mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {draft.mode === 'worker' && (
            <div className="field">
              <label className="label" htmlFor="worker">Worker address</label>
              <input
                id="worker"
                className="input mono"
                placeholder="https://palletio-proxy.your-name.workers.dev"
                value={draft.workerUrl}
                onChange={set('workerUrl')}
              />
            </div>
          )}

          {draft.mode === 'direct' && (
            <>
              <div className="field">
                <label className="label" htmlFor="key">Anthropic API key</label>
                <input
                  id="key"
                  className="input mono"
                  type="password"
                  placeholder="sk-ant-…"
                  value={draft.apiKey}
                  onChange={set('apiKey')}
                />
              </div>
              <p className="error-note">
                Stored in this browser's local storage. It never goes anywhere except to Anthropic,
                but anyone with access to this machine can read it, and it is visible to any script
                running on this page. Fine on your own laptop; do not use it on a shared machine or
                a link you send to a client — use the worker for that.
              </p>
            </>
          )}
        </div>

        {saved.length > 0 && (
          <div className="col">
            <span className="label">Saved palettes</span>
            <div className="export-list">
              {saved.map((p) => (
                <div className="export-row" key={p.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="export-row-title">{p.name || 'Untitled'}</div>
                    <div className="row" style={{ gap: 2, marginTop: 4 }}>
                      {p.colors.slice(0, 10).map((hex) => (
                        <span key={hex} style={{ width: 16, height: 16, borderRadius: 3, background: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => { onLoadPalette(p); onClose(); }}>Open</button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => setSaved(deleteSaved(p.id))}
                      aria-label={`Delete ${p.name}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="row">
          <button className="btn btn-primary" onClick={commit}>Save settings</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
