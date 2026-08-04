import { useState } from 'react';
import { ROLES, groupByRole } from '../lib/roles.js';
import { bestTextOn, contrastRatio } from '../lib/color.js';
import { IconArrowRight, IconWarning } from './Icons.jsx';

const TIERS = [
  { id: 'hero', label: 'Hero', size: 148, note: 'One colour. Buttons, brand moments, the thing people remember.' },
  { id: 'accent', label: 'Accents', size: 96, note: 'Supporting colours used in moments, never as the whole page.' },
  { id: 'light-neutral', label: 'Light neutrals', size: 72, note: 'Page and card backgrounds.' },
  { id: 'dark-neutral', label: 'Dark neutrals', size: 72, note: 'Body text and dark sections.' },
];

function Disc({ hex, size, label, onDragStart }) {
  const fg = bestTextOn(hex);
  return (
    <div
      className="role-disc"
      style={{ background: hex, width: size, height: size, color: fg }}
      draggable
      onDragStart={() => onDragStart(hex)}
      title={`${hex} — drag to another tier to change its role`}
    >
      <span className="role-disc-name">{label}</span>
      <span className="role-disc-hex mono">{hex}</span>
    </div>
  );
}

export default function RolesStep({ colors, roles, onRoleChange, onGoTo }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const groups = groupByRole(colors, roles);

  const heroCount = groups.hero.length;
  const hero = groups.hero[0];

  // The one check that actually matters here: can the hero hold a button label?
  const heroTextWarning = hero && (() => {
    const white = contrastRatio('#FFFFFF', hero);
    const black = contrastRatio('#000000', hero);
    return Math.max(white, black) < 4.5;
  })();

  const drop = (roleId) => {
    if (dragging) onRoleChange(dragging, roleId);
    setDragging(null);
    setOver(null);
  };

  if (!colors.length) {
    return (
      <>
        <div className="step-head">
          <h2 className="step-title">Assign roles</h2>
          <p className="step-sub">Give each colour a job.</p>
        </div>
        <div className="empty">
          <div className="empty-title">No colours yet</div>
          <button className="btn btn-primary" onClick={() => onGoTo('build')}>Back to build</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="step-head">
        <h2 className="step-title">Assign roles</h2>
        <p className="step-sub">
          Sized by how much of a layout each tier should occupy. Drag a colour between tiers, or use
          the dropdown. This is what turns a list of hexes into something you can hand to a developer.
        </p>
      </div>

      <div className="panel">
        {TIERS.map((tier) => (
          <div
            className="roles-tier"
            key={tier.id}
            onDragOver={(e) => { e.preventDefault(); setOver(tier.id); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); drop(tier.id); }}
          >
            <div className="roles-tier-label">{tier.label}</div>
            <p className="panel-note" style={{ textAlign: 'center' }}>{tier.note}</p>

            {groups[tier.id].length ? (
              <div className="roles-row">
                {groups[tier.id].map((hex) => (
                  <div className="role-item" key={hex}>
                    <Disc hex={hex} size={tier.size} label={tier.label.replace(/s$/, '')} onDragStart={setDragging} />
                    <select
                      className="select role-select"
                      value={roles[hex] || 'accent'}
                      onChange={(e) => onRoleChange(hex, e.target.value)}
                      aria-label={`Role for ${hex}`}
                    >
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="role-dropzone" data-over={over === tier.id || undefined}>
                Nothing assigned — drag a colour here
              </div>
            )}
          </div>
        ))}
      </div>

      {heroCount === 0 && (
        <div className="issue" data-severity="high">
          <div className="issue-head">
            <IconWarning />
            <h4 className="issue-title">No hero colour</h4>
          </div>
          <p className="issue-detail">
            Without one, nothing in the system says "this is the brand". Every layout built from this
            palette will have to decide again, and they will each decide differently.
          </p>
        </div>
      )}

      {heroTextWarning && (
        <div className="issue" data-severity="medium">
          <div className="issue-head">
            <IconWarning />
            <h4 className="issue-title">Hero cannot hold readable text</h4>
          </div>
          <p className="issue-detail">
            Neither white nor black reaches 4.5:1 on {hero}, so a button in this colour will need
            large or bold type to pass. Usable, but it constrains every button you make — worth
            knowing now rather than at build time.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="panel-note">
            Roles drive the tokens in your export and the mapping in the sample layouts.
          </p>
          <button className="btn btn-primary" onClick={() => onGoTo('export')}>
            See it in use <IconArrowRight />
          </button>
        </div>
      </div>
    </>
  );
}
