import { findIssues, paletteMetrics, healthScore, scoreBand } from '../lib/harmony.js';
import { IconCheck, IconArrowRight, IconWarning, IconLock } from './Icons.jsx';

const SEVERITY_TONE = { high: 'bad', medium: 'warn', low: 'info' };

const METRICS = [
  { key: 'temperature', low: 'Cool', high: 'Warm', gradient: 'linear-gradient(90deg,#4a7fb5,#8f7fa8,#c98c6a,#d97a45)' },
  { key: 'vibrance', low: 'Muted', high: 'Vibrant', gradient: 'linear-gradient(90deg,#9a9a95,#8a7fa0,#7a5fc0,#6b3fe0)' },
  { key: 'lightness', low: 'Dark', high: 'Light', gradient: 'linear-gradient(90deg,#1a1a19,#82827c,#e6e6e3,#ffffff)' },
  { key: 'variety', low: 'Single hue', high: 'Wide range', gradient: 'linear-gradient(90deg,#7a6a5a,#5a8f7a,#4a7fb5,#b5568f)' },
];

export function Metrics({ colors }) {
  if (colors.length < 2) return null;
  const metrics = paletteMetrics(colors);

  return (
    <div>
      {METRICS.map((m) => (
        <div className="metric" key={m.key}>
          <div className="metric-track" style={{ background: m.gradient }}>
            <span className="metric-marker" style={{ left: `${metrics[m.key] * 100}%` }} />
          </div>
          <div className="metric-ends">
            <span>{m.low}</span>
            <span>{m.high}</span>
          </div>
        </div>
      ))}
      <p className="panel-note">
        Where the palette sits overall. Neutrals are excluded — including them would drag every
        palette towards muted and tell you nothing. There is no correct position on these; they are
        for noticing when a palette is further from your intent than you thought.
      </p>
    </div>
  );
}

export default function HarmonyStep({ colors, locked, onApplyFix, onRemoveAt, onGoTo }) {
  const issues = findIssues(colors);
  const { score, breakdown } = healthScore(colors);
  const band = scoreBand(score);

  const actionable = issues.filter((i) => {
    if (i.index === null) return true;
    return !locked.includes(colors[i.index]);
  });
  const lockedOut = issues.length - actionable.length;

  if (colors.length < 2) {
    return (
      <>
        <div className="step-head">
          <h2 className="step-title">Analyse harmony</h2>
          <p className="step-sub">Where the palette is working against itself, and what would fix it.</p>
        </div>
        <div className="empty">
          <div className="empty-title">Not enough to analyse yet</div>
          <p className="empty-note">Add at least two colours and the checks will run automatically.</p>
          <button className="btn btn-primary" onClick={() => onGoTo('build')}>Back to build</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="step-head">
        <h2 className="step-title">Analyse harmony</h2>
        <p className="step-sub">
          Every flag below names a specific problem and, where a fix exists, the exact colour that
          resolves it. Nothing changes until you apply it, and locked colours are left alone.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">
            Health
            <span className="badge" data-tone={band.tone}>{band.label}</span>
          </h3>
          <span className="health-value mono" style={{ fontSize: 'var(--text-lg)' }}>{score}</span>
        </div>
        <div className="health-meter" style={{ width: '100%', height: 8 }}>
          <span className="health-fill" data-tone={band.tone} style={{ width: `${score}%` }} />
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-4) 0 0', display: 'grid', gap: 'var(--space-1)' }}>
          {breakdown.map((b, i) => (
            <li key={i} className="panel-note" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{b.label}</span>
              <span className="mono">{b.delta === 0 ? '—' : b.delta}</span>
            </li>
          ))}
        </ul>
      </div>

      {issues.length === 0 ? (
        <div className="panel">
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <span className="badge" data-tone="good"><IconCheck /></span>
            <div>
              <h3 className="panel-title" style={{ marginBottom: 2 }}>Nothing to fix</h3>
              <p className="panel-note">
                No duplicates, no outliers, no gaps in coverage. The palette holds together — take it
                to contrast testing and see whether it also holds up in use.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => onGoTo('contrast')}>
            Test contrast <IconArrowRight />
          </button>
        </div>
      ) : (
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="panel-note">
              {actionable.length} {actionable.length === 1 ? 'issue' : 'issues'} found
              {lockedOut > 0 && ` · ${lockedOut} skipped on locked colours`}
            </p>
          </div>

          {actionable.map((issue) => (
            <div className="issue" data-severity={issue.severity} key={issue.id}>
              <div className="issue-head">
                <IconWarning />
                <h4 className="issue-title">{issue.title}</h4>
                <span className="badge" data-tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</span>
              </div>

              <p className="issue-detail">{issue.detail}</p>

              <div className="issue-fix">
                {issue.index !== null && (
                  <div className="issue-preview">
                    <span className="issue-chip" style={{ background: colors[issue.index] }} />
                    <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>{colors[issue.index]}</span>
                  </div>
                )}

                {issue.fix && (
                  <>
                    <IconArrowRight />
                    <div className="issue-preview">
                      <span className="issue-chip" style={{ background: issue.fix }} />
                      <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>{issue.fix}</span>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => onApplyFix(issue.index, issue.fix)}>
                      {issue.fixLabel}
                    </button>
                  </>
                )}

                {issue.action === 'remove' && (
                  <button className="btn btn-sm" onClick={() => onRemoveAt(issue.index)}>
                    {issue.fixLabel}
                  </button>
                )}

                {issue.action === 'suggest' && (
                  <button className="btn btn-sm" onClick={() => onGoTo('build')}>
                    {issue.fixLabel}
                  </button>
                )}
              </div>
            </div>
          ))}

          {lockedOut > 0 && (
            <p className="panel-note" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <IconLock /> {lockedOut} {lockedOut === 1 ? 'issue affects a locked colour' : 'issues affect locked colours'} and
              {' '}{lockedOut === 1 ? 'was' : 'were'} skipped. Unlock in the build step to see the suggested fixes.
            </p>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Palette character</h3>
        </div>
        <Metrics colors={colors} />
      </div>
    </>
  );
}
