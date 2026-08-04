import { useState, useRef } from 'react';
import { normalizeHex, hexToOklch, formatOklch } from '../lib/color.js';
import { ROLES } from '../lib/roles.js';
import {
  IconGrip, IconCopy, IconLock, IconUnlock, IconTrash, IconPlus,
  IconDropper, IconUpload, IconWarning,
} from './Icons.jsx';
import ImportModal from './ImportModal.jsx';

function Swatch({
  hex, role, locked, flagged, index,
  onChange, onRemove, onToggleLock, onCopy, onRoleChange,
  onDragStart, onDragOver, onDrop, dragging,
}) {
  const [draft, setDraft] = useState(hex);
  const inputRef = useRef(null);
  const lch = hexToOklch(hex);

  const commit = () => {
    const next = normalizeHex(draft);
    if (next && next !== hex) onChange(next);
    else setDraft(hex);
  };

  return (
    <div
      className="swatch"
      data-dragging={dragging || undefined}
      data-flagged={flagged || undefined}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
    >
      <div className="swatch-fill-wrap">
        <button
          type="button"
          className="swatch-fill"
          style={{ background: hex }}
          onClick={() => inputRef.current?.click()}
          aria-label={`Change ${hex}`}
        />
        {flagged && <span className="swatch-flag">Flagged</span>}
        <button
          type="button"
          className="swatch-drag"
          draggable
          onDragStart={() => onDragStart(index)}
          aria-label={`Drag ${hex} to reorder`}
        >
          <IconGrip />
        </button>
      </div>

      <input
        ref={inputRef}
        type="color"
        value={hex}
        onChange={(e) => onChange(normalizeHex(e.target.value))}
        className="visually-hidden"
        tabIndex={-1}
      />

      <div className="swatch-body">
        <input
          className="swatch-hex mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          spellCheck={false}
          aria-label="Hex value"
        />
        <div className="swatch-meta">{formatOklch(lch)}</div>

        <div className="swatch-tools">
          <button className="btn-icon" onClick={() => onCopy(hex)} title="Copy hex" aria-label="Copy hex">
            <IconCopy />
          </button>
          <button
            className="btn-icon"
            onClick={onToggleLock}
            title={locked ? 'Unlock — allow fixes to change this' : 'Lock — protect from fixes'}
            aria-label={locked ? 'Unlock colour' : 'Lock colour'}
          >
            {locked ? <IconLock /> : <IconUnlock />}
          </button>
          <button className="btn-icon btn-danger" onClick={onRemove} title="Remove" aria-label="Remove colour">
            <IconTrash />
          </button>
        </div>

        <select
          className="select"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          aria-label={`Role for ${hex}`}
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function BuildStep({
  colors, roles, locked, flaggedIndices,
  onAdd, onChange, onRemove, onReorder, onToggleLock, onRoleChange, onCopy,
  settings, onToast,
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const pickerRef = useRef(null);

  const hasEyedropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const useEyedropper = async () => {
    try {
      const result = await new window.EyeDropper().open();
      const hex = normalizeHex(result.sRGBHex);
      if (hex) onAdd([hex]);
    } catch {
      /* user cancelled — nothing to report */
    }
  };

  const handleDrop = (target) => {
    if (dragIndex === null || dragIndex === target) return;
    onReorder(dragIndex, target);
    setDragIndex(null);
    setHoverIndex(null);
  };

  return (
    <>
      <div className="step-head">
        <h2 className="step-title">Build your palette</h2>
        <p className="step-sub">
          Add the colours you already have, or start from an image, a website or a brief.
          Roles are assigned automatically as you go and can be changed at any point.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Colours <span className="tag">{colors.length}</span></h3>
          <div className="row">
            {hasEyedropper && (
              <button className="btn btn-sm" onClick={useEyedropper}>
                <IconDropper /> Pick from screen
              </button>
            )}
            <button className="btn btn-sm" onClick={() => setImportOpen(true)}>
              <IconUpload /> Import
            </button>
          </div>
        </div>

        {colors.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nothing here yet</div>
            <p className="empty-note">
              Drop in a hex code, lift colours from an image or a live site, or describe the brand
              and let the tool propose a starting point.
            </p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => setImportOpen(true)}>
                <IconUpload /> Import colours
              </button>
              <button className="btn" onClick={() => pickerRef.current?.click()}>
                <IconPlus /> Pick a colour
              </button>
            </div>
            <input
              ref={pickerRef}
              type="color"
              className="visually-hidden"
              onChange={(e) => onAdd([normalizeHex(e.target.value)])}
            />
          </div>
        ) : (
          <div className="swatch-grid">
            {colors.map((hex, i) => (
              <Swatch
                key={`${hex}-${i}`}
                hex={hex}
                index={i}
                role={roles[hex] || 'accent'}
                locked={locked.includes(hex)}
                flagged={flaggedIndices.includes(i)}
                dragging={dragIndex === i}
                onChange={(next) => onChange(i, next)}
                onRemove={() => onRemove(i)}
                onToggleLock={() => onToggleLock(hex)}
                onRoleChange={(role) => onRoleChange(hex, role)}
                onCopy={onCopy}
                onDragStart={setDragIndex}
                onDragOver={setHoverIndex}
                onDrop={handleDrop}
              />
            ))}

            <button className="swatch-add" onClick={() => pickerRef.current?.click()}>
              <IconPlus />
              <span className="swatch-add-title">Add a colour</span>
              <span className="swatch-add-note">Opens your system colour picker</span>
            </button>
            <input
              ref={pickerRef}
              type="color"
              className="visually-hidden"
              onChange={(e) => onAdd([normalizeHex(e.target.value)])}
            />
          </div>
        )}

        {colors.length > 0 && (
          <p className="panel-note" style={{ marginTop: 'var(--space-4)' }}>
            Click a swatch to open the colour picker, type over the hex to set it exactly, or drag the
            handle to reorder. Locking a colour protects it when you apply fixes in the next step.
          </p>
        )}
      </div>

      {colors.length > 14 && (
        <div className="issue" data-severity="low">
          <div className="issue-head">
            <IconWarning />
            <h4 className="issue-title">That is a lot of colours</h4>
          </div>
          <p className="issue-detail">
            Past about twelve, a palette stops being a system and starts being a mood board. Consider
            which of these are genuinely different decisions and which are variations you could
            generate from a smaller set.
          </p>
        </div>
      )}

      {importOpen && (
        <ImportModal
          settings={settings}
          onClose={() => setImportOpen(false)}
          onImport={(hexes) => { onAdd(hexes); setImportOpen(false); }}
          onToast={onToast}
        />
      )}
    </>
  );
}

export { Swatch };
