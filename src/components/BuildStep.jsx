import { useState } from 'react';
import { normalizeHex, hexToOklch, formatOklch } from '../lib/color.js';
import { ROLES } from '../lib/roles.js';
import {
  IconGrip, IconCopy, IconLock, IconUnlock, IconTrash, IconPlus,
  IconDropper, IconUpload, IconWarning,
} from './Icons.jsx';
import ImportModal from './ImportModal.jsx';
import ColorPicker, { PickerPopover } from './ColorPicker.jsx';

function Swatch({
  hex, role, locked, flagged, index,
  onChange, onRemove, onToggleLock, onCopy, onRoleChange, onOpenPicker,
  onDragStart, onDragOver, onDrop, dragging,
}) {
  const [draft, setDraft] = useState(hex);
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
          onClick={(e) => onOpenPicker(index, e.currentTarget.getBoundingClientRect())}
          aria-label={`Edit ${hex}`}
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
  const [, setHoverIndex] = useState(null);

  /* One picker at a time. An `index` of null means "adding a new colour"
     rather than editing an existing one. */
  const [picker, setPicker] = useState(null);

  /* A new swatch opens on the last colour in the palette rather than on a
     default grey — you are usually adding a relative, not a stranger. */
  const openPicker = (index, rect) => setPicker({
    index,
    rect,
    seed: index === null ? (colors[colors.length - 1] || '#6E7FA8') : colors[index],
  });

  const commitPicker = (hex) => {
    if (!picker) return;
    if (picker.index === null) onAdd([hex]);
    else onChange(picker.index, hex);
  };

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
              <button
                className="btn"
                onClick={(e) => openPicker(null, e.currentTarget.getBoundingClientRect())}
              >
                <IconPlus /> Pick a colour
              </button>
            </div>
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
                onOpenPicker={openPicker}
                onDragStart={setDragIndex}
                onDragOver={setHoverIndex}
                onDrop={handleDrop}
              />
            ))}

            <button
              className="swatch-add"
              onClick={(e) => openPicker(null, e.currentTarget.getBoundingClientRect())}
            >
              <IconPlus />
              <span className="swatch-add-title">Add a colour</span>
              <span className="swatch-add-note">Opens the OKLCH picker</span>
            </button>
          </div>
        )}

        {colors.length > 0 && (
          <p className="panel-note" style={{ marginTop: 'var(--space-4)' }}>
            Click a swatch to open the picker, type over the hex to set it exactly, or drag the
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

      {picker && (
        <PickerPopover anchorRect={picker.rect}>
          <ColorPicker
            value={picker.seed}
            palette={colors}
            title={picker.index === null ? 'Add a colour' : 'Edit colour'}
            onCommit={commitPicker}
            onClose={() => setPicker(null)}
          />
        </PickerPopover>
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
