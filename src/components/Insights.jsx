import { useState, useEffect } from 'react';
import { suggestLightNeutrals, suggestDarkNeutrals, suggestHarmony } from '../lib/suggest.js';
import { findIssues, coverage } from '../lib/harmony.js';
import { Metrics, Description } from './HarmonyStep.jsx';
import { IconShuffle, IconPlus, IconSparkle, IconArrowRight, IconCheck } from './Icons.jsx';

const NEXT = {
  build: { to: 'harmony', title: 'Check it holds together', note: 'Find duplicates, outliers and gaps in coverage.' },
  harmony: { to: 'contrast', title: 'Test it for readability', note: 'Every pairing scored against WCAG and APCA.' },
  contrast: { to: 'roles', title: 'Give each colour a job', note: 'Hero, accent, neutral — this is what makes it a system.' },
  roles: { to: 'export', title: 'See it in use', note: 'Five typographic directions, then every export format.' },
  export: null,
};

function SuggestionGroup({ title, kind, items, onAdd, onShuffle, added }) {
  const [expanded, setExpanded] = useState(2);

  return (
    <div className="insight-card">
      <div className="insight-head">
        <h3 className="insight-title">
          {title}
          {added > 0 && <span className="tag">{added} added</span>}
        </h3>
        <button className="btn-icon" onClick={onShuffle} title="Show different options" aria-label="Shuffle">
          <IconShuffle />
        </button>
      </div>

      {items.slice(0, expanded).map((s) => (
        <div className="suggestion" key={s.hex}>
          <span className="suggestion-chip" style={{ background: s.hex }} />
          <div>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <span className="suggestion-hex mono">{s.hex}</span>
              {s.relation && <span className="tag">{s.relation}</span>}
            </div>
            <p className="suggestion-note">{s.note}</p>
            <button className="btn btn-sm" onClick={() => onAdd(s.hex, kind)}>
              <IconPlus /> Add to palette
            </button>
          </div>
        </div>
      ))}

      {items.length > expanded && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 'var(--space-2)' }}
          onClick={() => setExpanded(items.length)}
        >
          Show {items.length - expanded} more
        </button>
      )}

      {items.length === 0 && (
        <p className="panel-note">Nothing to suggest here — the palette already covers this.</p>
      )}
    </div>
  );
}

export default function Insights({ colors, step, onAdd, onGoTo, addedCounts }) {
  const [seed, setSeed] = useState(0);
  const [suggestions, setSuggestions] = useState({ light: [], dark: [], harmony: [] });

  useEffect(() => {
    setSuggestions({
      light: suggestLightNeutrals(colors),
      dark: suggestDarkNeutrals(colors),
      harmony: suggestHarmony(colors),
    });
  }, [colors, seed]);

  const issues = findIssues(colors);
  const cov = coverage(colors);
  const next = NEXT[step];

  return (
    <aside className="insights">
      <div className="rail-heading" style={{ padding: 0 }}>Insights</div>

      {step === 'build' && (
        <>
          <SuggestionGroup
            title="Light neutrals"
            kind="light-neutral"
            items={suggestions.light}
            added={addedCounts['light-neutral'] || 0}
            onAdd={onAdd}
            onShuffle={() => setSeed((s) => s + 1)}
          />
          <SuggestionGroup
            title="Dark neutrals"
            kind="dark-neutral"
            items={suggestions.dark}
            added={addedCounts['dark-neutral'] || 0}
            onAdd={onAdd}
            onShuffle={() => setSeed((s) => s + 1)}
          />
          <SuggestionGroup
            title="Harmony colours"
            kind="harmony"
            items={suggestions.harmony}
            added={addedCounts.harmony || 0}
            onAdd={onAdd}
            onShuffle={() => setSeed((s) => s + 1)}
          />
        </>
      )}

      {step !== 'build' && colors.length >= 2 && (
        <>
          <div className="insight-card">
            <div className="insight-head">
              <h3 className="insight-title"><IconSparkle /> Status</h3>
            </div>
            {issues.length === 0 ? (
              <p className="suggestion-note" style={{ margin: 0 }}>
                <IconCheck /> No outstanding issues. The palette covers backgrounds, text and a lead
                colour, with nothing fighting for the same job.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
                {issues.slice(0, 4).map((i) => (
                  <li key={i.id} className="suggestion-note" style={{ margin: 0 }}>{i.title}</li>
                ))}
                {issues.length > 4 && (
                  <li className="suggestion-note" style={{ margin: 0 }}>and {issues.length - 4} more</li>
                )}
              </ul>
            )}
            {issues.length > 0 && step !== 'harmony' && (
              <button className="btn btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={() => onGoTo('harmony')}>
                Review and fix
              </button>
            )}
          </div>

          <div className="insight-card">
            <div className="insight-head">
              <h3 className="insight-title">Coverage</h3>
            </div>
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              {[
                ['Light neutral', cov.hasLightNeutral],
                ['Dark neutral', cov.hasDarkNeutral],
                ['Mid-tone to lead with', cov.hasAnchor],
              ].map(([label, ok]) => (
                <div className="row" key={label} style={{ justifyContent: 'space-between' }}>
                  <span className="suggestion-note" style={{ margin: 0 }}>{label}</span>
                  <span className="badge" data-tone={ok ? 'good' : 'warn'}>{ok ? 'Yes' : 'Missing'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-head">
              <h3 className="insight-title">Character</h3>
            </div>
            <Description colors={colors} />
            <Metrics colors={colors} />
          </div>
        </>
      )}

      {next && (
        <div className="next-card">
          <span className="label">Next</span>
          <strong style={{ fontSize: 'var(--text-sm)' }}>{next.title}</strong>
          <p className="panel-note">{next.note}</p>
          <button className="btn btn-sm btn-primary" onClick={() => onGoTo(next.to)}>
            Continue <IconArrowRight />
          </button>
        </div>
      )}
    </aside>
  );
}
