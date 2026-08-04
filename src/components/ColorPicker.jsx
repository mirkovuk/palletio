import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  hexToOklch, oklchToHex, normalizeHex, maxChroma, isInGamut,
  CHROMA_CEILING, formatOklch, contrastRatio, hueName, clamp,
} from '../lib/color.js';
import { IconDropper, IconCheck, IconX } from './Icons.jsx';

/**
 * ColorPicker — an OKLCH picker, not an HSL one.
 *
 * The system picker reasons in RGB/HSL, which is the opposite of how the rest
 * of this tool works. Two consequences that matter in practice:
 *
 *   Dragging "lightness" in HSL changes perceived lightness by wildly different
 *   amounts depending on hue, so you cannot build a tonal ramp by eye.
 *
 *   sRGB's reachable region in OKLCH is a lopsided shape that changes per hue.
 *   A picker that hides it lets you pick a colour that silently clamps to
 *   something else. Here the boundary is drawn, so you can see where you are
 *   pushing against it.
 *
 * Internal state is LCH, not hex. Round-tripping through hex on every drag
 * would lose hue and chroma the moment a value clamps at the gamut edge, and
 * the slider would drift under the cursor.
 */

const PLANE_W = 264;
const PLANE_H = 200;
const HUE_STEPS = 72;

function Plane({ L, C, h, onChange }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  /* Repaint only when hue changes — the plane is a slice at constant hue, so
     moving the cursor within it costs nothing. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(PLANE_W, PLANE_H);
    const data = image.data;

    for (let y = 0; y < PLANE_H; y++) {
      const lightness = 1 - y / (PLANE_H - 1);
      // Anything identical to grey at this lightness is not reachable colour,
      // it is just black or white with a number attached. Compare per row so
      // the cost is one extra conversion per row rather than per pixel.
      const achromatic = oklchToHex({ L: lightness, C: 0, h });

      for (let x = 0; x < PLANE_W; x++) {
        const chroma = (x / (PLANE_W - 1)) * CHROMA_CEILING;
        const i = (y * PLANE_W + x) * 4;
        if (!isInGamut({ L: lightness, C: chroma, h })) {
          data[i + 3] = 0; // outside sRGB — leave transparent
          continue;
        }
        const hex = oklchToHex({ L: lightness, C: chroma, h });
        if (chroma > 0.01 && hex === achromatic) {
          data[i + 3] = 0;
          continue;
        }
        data[i] = parseInt(hex.slice(1, 3), 16);
        data[i + 1] = parseInt(hex.slice(3, 5), 16);
        data[i + 2] = parseInt(hex.slice(5, 7), 16);
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [h]);

  const pick = useCallback((event) => {
    const rect = boxRef.current.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const nextL = 1 - y / rect.height;
    const nextC = (x / rect.width) * CHROMA_CEILING;
    onChange({ L: nextL, C: Math.min(nextC, maxChroma(nextL, h)) });
  }, [h, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => pick(e);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, pick]);

  const key = (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves = {
      ArrowUp: { L: L + step },
      ArrowDown: { L: L - step },
      ArrowRight: { C: C + step * 0.4 },
      ArrowLeft: { C: C - step * 0.4 },
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    const L2 = clamp(next.L ?? L, 0, 1);
    const C2 = clamp(next.C ?? C, 0, maxChroma(L2, h));
    onChange({ L: L2, C: C2 });
  };

  const left = (C / CHROMA_CEILING) * 100;
  const top = (1 - L) * 100;

  return (
    <div
      ref={boxRef}
      className="picker-plane"
      onPointerDown={(e) => { e.preventDefault(); setDragging(true); pick(e); }}
      onKeyDown={key}
      tabIndex={0}
      role="application"
      aria-label={`Lightness and chroma. Lightness ${(L * 100).toFixed(0)} percent, chroma ${C.toFixed(3)}. Arrow keys to adjust.`}
    >
      <canvas ref={canvasRef} width={PLANE_W} height={PLANE_H} className="picker-plane-canvas" />
      <span
        className="picker-cursor"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          borderColor: L > 0.55 ? '#000' : '#fff',
        }}
      />
    </div>
  );
}

function HueSlider({ L, C, h, onChange }) {
  // Swatches are drawn at the current lightness and chroma so the strip shows
  // what each hue would actually give you, not a generic rainbow.
  const stops = useMemo(() => {
    const out = [];
    for (let i = 0; i <= HUE_STEPS; i++) {
      const hue = (i / HUE_STEPS) * 360;
      out.push(oklchToHex({ L, C: Math.min(C || 0.12, maxChroma(L, hue)), h: hue }));
    }
    return out;
  }, [L, C]);

  return (
    <div className="field">
      <div className="picker-row-label">
        <span className="label">Hue</span>
        <span className="picker-value mono">{Math.round(h)}° · {hueName(h)}</span>
      </div>
      <div className="picker-slider-wrap">
        <div
          className="picker-slider-track"
          style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }}
        />
        <input
          type="range"
          min="0"
          max="359"
          step="1"
          value={Math.round(h)}
          onChange={(e) => onChange(+e.target.value)}
          className="picker-slider"
          aria-label="Hue"
        />
      </div>
    </div>
  );
}

export default function ColorPicker({
  value, onChange, onCommit, onClose, palette = [], title = 'Pick a colour',
}) {
  const [lch, setLch] = useState(() => hexToOklch(value || '#808080'));
  const [draft, setDraft] = useState(value || '#808080');
  const rootRef = useRef(null);

  const hex = useMemo(() => oklchToHex(lch), [lch]);

  useEffect(() => { setDraft(hex); }, [hex]);
  useEffect(() => { onChange?.(hex); }, [hex]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Dismiss on outside click or Escape. */
  useEffect(() => {
    const down = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    const key = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const set = (patch) => setLch((prev) => ({ ...prev, ...patch }));

  const commitHex = () => {
    const next = normalizeHex(draft);
    if (next) setLch(hexToOklch(next));
    else setDraft(hex);
  };

  const eyedropper = async () => {
    try {
      const result = await new window.EyeDropper().open();
      const picked = normalizeHex(result.sRGBHex);
      if (picked) setLch(hexToOklch(picked));
    } catch {
      /* cancelled */
    }
  };

  const atGamutEdge = lch.C >= maxChroma(lch.L, lch.h) - 0.002 && lch.C > 0.01;
  const onWhite = contrastRatio(hex, '#FFFFFF');
  const onBlack = contrastRatio(hex, '#000000');

  return (
    <div className="picker" ref={rootRef} role="dialog" aria-label={title}>
      <div className="picker-head">
        <span className="picker-preview" style={{ background: hex }} />
        <div className="grow">
          <input
            className="picker-hex mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
            spellCheck={false}
            aria-label="Hex value"
          />
          <span className="picker-oklch mono">{formatOklch(lch)}</span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close"><IconX /></button>
      </div>

      <Plane L={lch.L} C={lch.C} h={lch.h} onChange={set} />

      <div className="picker-axes">
        <span>← Neutral</span>
        <span>Saturated →</span>
      </div>

      <HueSlider L={lch.L} C={lch.C} h={lch.h} onChange={(h) => set({ h, C: Math.min(lch.C, maxChroma(lch.L, h)) })} />

      <div className="picker-readout">
        <div>
          <span className="label">Lightness</span>
          <span className="picker-value mono">{(lch.L * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="label">Chroma</span>
          <span className="picker-value mono">{lch.C.toFixed(3)}</span>
        </div>
        <div>
          <span className="label">On white / black</span>
          <span className="picker-value mono">{onWhite.toFixed(1)} / {onBlack.toFixed(1)}</span>
        </div>
      </div>

      {atGamutEdge && (
        <p className="picker-note">
          At the edge of what sRGB can show at this lightness. Push further and the colour clamps
          rather than getting more saturated — drop the lightness to reach more chroma.
        </p>
      )}

      {palette.length > 0 && (
        <div className="field">
          <span className="label">In this palette</span>
          <div className="chip-row">
            {palette.map((c) => (
              <button
                key={c}
                className="chip-pick"
                onClick={() => setLch(hexToOklch(c))}
                title={c}
              >
                <span className="chip-pick-dot" style={{ background: c }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="picker-actions">
        {typeof window !== 'undefined' && 'EyeDropper' in window && (
          <button className="btn btn-sm" onClick={eyedropper}>
            <IconDropper /> From screen
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-sm btn-primary" onClick={() => { onCommit?.(hex); onClose?.(); }}>
          <IconCheck /> Done
        </button>
      </div>
    </div>
  );
}

/**
 * Positions a picker next to whatever opened it, flipping when it would run
 * off the bottom or right of the viewport. Fixed positioning keeps it out of
 * the swatch grid's overflow.
 */
export function PickerPopover({ anchorRect, children }) {
  const [style, setStyle] = useState({ visibility: 'hidden' });
  const ref = useRef(null);

  useEffect(() => {
    if (!anchorRect || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const margin = 8;

    let top = anchorRect.bottom + margin;
    if (top + box.height > window.innerHeight - margin) {
      top = Math.max(margin, anchorRect.top - box.height - margin);
    }

    let left = anchorRect.left;
    if (left + box.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - box.width - margin);
    }

    setStyle({ top, left, visibility: 'visible' });
  }, [anchorRect]);

  return (
    <div ref={ref} className="picker-popover" style={style}>
      {children}
    </div>
  );
}
