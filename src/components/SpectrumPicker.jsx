import { useState, useRef, useEffect, useCallback } from 'react';
import { hexToOklch, oklchToHex, maxChroma, clamp } from '../lib/color.js';

/**
 * SpectrumPicker — a full hue wheel, for the splash only.
 *
 * The app's ColorPicker shows an L/C plane at one fixed hue plus a separate
 * strip to change hue — correct for careful palette editing, where you are
 * usually adjusting one axis at a time. But it means the picker never looks
 * "whole": you only ever see a slice, and finding a hue means dragging a
 * thin bar first.
 *
 * This is the opposite trade: hue goes all the way around as an angle,
 * chroma is the radius, and lightness is a separate slider underneath. One
 * view holds the entire spectrum at once — the point of putting a picker on
 * a splash screen — at the cost of being coarser to fine-tune than the
 * app's picker. That trade is correct here and wrong there, which is why
 * this is a separate component rather than a mode flag on ColorPicker.
 */

const SIZE = 216;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 2;

function paint(ctx, lightness) {
  const image = ctx.createImageData(SIZE, SIZE);
  const data = image.data;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - CENTER;
      const dy = y - CENTER;
      const r = Math.sqrt(dx * dx + dy * dy);
      const i = (y * SIZE + x) * 4;

      if (r > RADIUS) {
        data[i + 3] = 0;
        continue;
      }

      // Angle becomes hue, all the way around — this is what makes it read
      // as "the whole spectrum" rather than a slice of it.
      const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 180;
      const ceiling = maxChroma(lightness, hue);
      const chroma = (r / RADIUS) * ceiling;

      const hex = oklchToHex({ L: lightness, C: chroma, h: hue });
      data[i] = parseInt(hex.slice(1, 3), 16);
      data[i + 1] = parseInt(hex.slice(3, 5), 16);
      data[i + 2] = parseInt(hex.slice(5, 7), 16);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export default function SpectrumPicker({ value, onChange }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [lch, setLch] = useState(() => hexToOklch(value || '#F71F1F'));

  // Repainted only on lightness change — moving within the wheel at a fixed
  // lightness costs nothing, exactly the same economy as the app picker's
  // fixed-hue plane, just on the other axis.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) paint(ctx, lch.L);
  }, [lch.L]);

  const pick = useCallback((event) => {
    const rect = boxRef.current.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width) - rect.width / 2;
    const y = clamp(event.clientY - rect.top, 0, rect.height) - rect.height / 2;
    const r = Math.min(Math.sqrt(x * x + y * y), RADIUS);
    const hue = (Math.atan2(y, x) * 180) / Math.PI + 180;
    const ceiling = maxChroma(lch.L, hue);
    const next = { ...lch, h: hue, C: (r / RADIUS) * ceiling };
    setLch(next);
    onChange(oklchToHex(next).toUpperCase());
  }, [lch, onChange]);

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

  const setLightness = (L) => {
    const next = { ...lch, L, C: Math.min(lch.C, maxChroma(L, lch.h)) };
    setLch(next);
    onChange(oklchToHex(next).toUpperCase());
  };

  // Cursor position on the wheel, derived from state rather than stored
  // separately — the two can never drift apart.
  const ceiling = maxChroma(lch.L, lch.h);
  const r = ceiling > 0 ? (lch.C / ceiling) * RADIUS : 0;
  const rad = ((lch.h - 180) * Math.PI) / 180;
  const cursorX = CENTER + r * Math.cos(rad);
  const cursorY = CENTER + r * Math.sin(rad);

  return (
    <div className="spectrum-picker">
      <div
        ref={boxRef}
        className="spectrum-wheel"
        onPointerDown={(e) => { setDragging(true); pick(e); }}
      >
        <canvas ref={canvasRef} width={SIZE} height={SIZE} />
        <span
          className="spectrum-cursor"
          style={{ left: cursorX, top: cursorY, background: oklchToHex(lch) }}
        />
      </div>

      <div className="spectrum-lightness">
        <input
          type="range"
          min="0.05"
          max="0.95"
          step="0.01"
          value={lch.L}
          onChange={(e) => setLightness(+e.target.value)}
          aria-label="Lightness"
          style={{
            background: `linear-gradient(90deg, #000, ${oklchToHex({ ...lch, L: 0.5, C: Math.min(lch.C, maxChroma(0.5, lch.h)) })}, #fff)`,
          }}
        />
      </div>
    </div>
  );
}
