import { useState, useMemo } from 'react';
import { buildPairings, PAIRING_FILTERS } from '../lib/roles.js';
import { simulateCVD, CVD_TYPES } from '../lib/color.js';
import { IconArrowRight } from './Icons.jsx';

const STANDARDS = [
  { id: 'wcag', label: 'WCAG 2.1', note: 'The legal standard almost everywhere' },
  { id: 'apca', label: 'APCA', note: 'Draft WCAG 3 — models real readability more closely' },
  { id: 'both', label: 'Both', note: 'Compare the two side by side' },
];

export default function ContrastStep({ colors, onGoTo }) {
  const [filter, setFilter] = useState('aaNormal');
  const [standard, setStandard] = useState('wcag');
  const [cvd, setCvd] = useState('normal');
  const [largeText, setLargeText] = useState(false);

  const pairings = useMemo(() => buildPairings(colors), [colors]);

  const counts = useMemo(() => {
    const out = {};
    for (const f of PAIRING_FILTERS) out[f.id] = pairings.filter(f.test).length;
    return out;
  }, [pairings]);

  const shown = useMemo(() => {
    const f = PAIRING_FILTERS.find((x) => x.id === filter) || PAIRING_FILTERS[0];
    return pairings.filter(f.test);
  }, [pairings, filter]);

  if (colors.length < 2) {
    return (
      <>
        <div className="step-head">
          <h2 className="step-title">Test contrast</h2>
          <p className="step-sub">Every combination, scored, so you know which pairs you can actually use.</p>
        </div>
        <div className="empty">
          <div className="empty-title">Two colours minimum</div>
          <p className="empty-note">Contrast is a relationship — there is nothing to measure yet.</p>
          <button className="btn btn-primary" onClick={() => onGoTo('build')}>Back to build</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="step-head">
        <h2 className="step-title">Test contrast</h2>
        <p className="step-sub">
          Every ordered pair in the palette, both directions. Direction matters: dark-on-light and
          light-on-dark share a WCAG ratio but behave differently on a real screen, which is exactly
          what APCA was built to capture.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Options</h3>
        </div>

        <div className="row" style={{ gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <div className="field">
            <span className="label">Standard</span>
            <div className="filter-bar">
              {STANDARDS.map((s) => (
                <button
                  key={s.id}
                  className="filter-btn"
                  aria-pressed={standard === s.id}
                  onClick={() => setStandard(s.id)}
                  title={s.note}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="cvd">Simulate colour vision</label>
            <select id="cvd" className="select" value={cvd} onChange={(e) => setCvd(e.target.value)} style={{ width: 240 }}>
              {CVD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label} — {t.note}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Sample size</span>
            <div className="filter-bar">
              <button className="filter-btn" aria-pressed={!largeText} onClick={() => setLargeText(false)}>Body</button>
              <button className="filter-btn" aria-pressed={largeText} onClick={() => setLargeText(true)}>Large</button>
            </div>
          </div>
        </div>

        {cvd !== 'normal' && (
          <p className="panel-note" style={{ marginTop: 'var(--space-4)' }}>
            Samples below are shown as they would appear with {CVD_TYPES.find((t) => t.id === cvd).label.toLowerCase()}.
            Scores are unchanged — contrast maths is luminance-based and does not shift, which is the
            point: two colours can pass every ratio and still be indistinguishable to a viewer here.
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Pairings</h3>
        </div>

        <div className="filter-bar" style={{ marginBottom: 'var(--space-4)' }}>
          {PAIRING_FILTERS.map((f) => (
            <button
              key={f.id}
              className="filter-btn"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              title={f.note}
            >
              <span>{f.label}</span>
              <span className="filter-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="pair-empty">
            Nothing in the palette meets this bar. If this is the AA filter, the palette cannot
            currently set readable body text in its own colours — add a darker dark or a lighter
            light in the build step.
          </div>
        ) : (
          <div className="pair-list">
            {shown.slice(0, 90).map((p) => (
              <div className="pair" key={p.id}>
                <div
                  className={`pair-sample${largeText ? ' pair-sample-large' : ''}`}
                  style={{
                    background: simulateCVD(p.bg, cvd),
                    color: simulateCVD(p.text, cvd),
                  }}
                >
                  {largeText ? 'Headline sample' : 'The quick brown fox jumps over the lazy dog'}
                </div>

                <div className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--fg-faint)', textAlign: 'right' }}>
                  {p.text}<br />on {p.bg}
                </div>

                {(standard === 'wcag' || standard === 'both') && (
                  <div className="pair-score">
                    {p.ratio.toFixed(2)}:1
                    <div className="pair-score-sub">
                      {p.wcag.aaaNormal ? 'AAA' : p.wcag.aaNormal ? 'AA' : p.wcag.aaLarge ? 'AA large' : 'Fails'}
                    </div>
                  </div>
                )}

                {(standard === 'apca' || standard === 'both') && (
                  <div className="pair-score">
                    Lc {Math.round(p.lc)}
                    <div className="pair-score-sub">{p.apca.label}</div>
                  </div>
                )}
              </div>
            ))}
            {shown.length > 90 && (
              <p className="panel-note">Showing the first 90 of {shown.length}. Narrow the filter to see the rest.</p>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">What the numbers mean</h3>
        </div>
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <p className="issue-detail">
            <strong>WCAG 2.1</strong> compares relative luminance and returns a ratio. It is what
            accessibility law and most audits refer to, so it is the number to quote. It is also
            known to be unreliable at the dark end, where it consistently over-rates pairings that
            are hard to read in practice.
          </p>
          <p className="issue-detail">
            <strong>APCA</strong> returns Lc, roughly −108 to 106, and accounts for text size, weight
            and polarity. Around 60 works for large text, 75 for body copy, 90 for anything small.
            It is a candidate for WCAG 3 rather than a current requirement — useful for judgement,
            not yet for compliance.
          </p>
          <p className="issue-detail">
            The two disagree most on light text over mid-tone colour, which is precisely where most
            brand palettes get used. Where they disagree, trust APCA for the design decision and
            report WCAG for the audit.
          </p>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => onGoTo('roles')}>
          Assign roles <IconArrowRight />
        </button>
      </div>
    </>
  );
}
