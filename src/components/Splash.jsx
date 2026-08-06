import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Splash.jsx — the front door.
 *
 * Two versions of the same screen:
 *
 *   First visit   — the pitch, with a button. Nothing moves until you click.
 *   Coming back   — a greeting and a progress bar that carries you through.
 *
 * The returning variant is a deliberate risk: any automatic delay is time
 * taken from someone who came here to do something. Three things keep it
 * from being annoying — it is short, it is skippable by clicking or pressing
 * any key, and it does not run at all for anyone who has asked for reduced
 * motion. A landing animation you cannot escape is the fastest way to make a
 * returning user resent your tool.
 *
 * The bar is a transition, not a measurement. Nothing is loading behind it,
 * and it does not pretend otherwise — no percentage, no "loading" label, no
 * fake stalling at 90%. It is a curtain, and it moves at a constant rate
 * because a progress bar that lies about progress is worse than no bar.
 */

const COPY = [
  'Palletio is a free colour palette tool.',
  'Start with your favourite hues, use an existing palette, or upload a screenshot of a site you like.',
  'Preview your tones over tonally matched imagery, and get straight answers on contrast, readability and accessibility.',
  'Upload your logo and test it in every combination.',
];

const DURATION = 1900;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function Splash({
  onStart,
  returning = false,
  version = 'v0.1 2026',
  wordmark = './wordmark.webp',
}) {
  /* Loaded via a detached Image() rather than rendered as an <img>, so it can
     be applied as a CSS background instead of a foreground element. A
     background-image fills its box exactly — top and sides included, no
     padding to leave a gap and no element edge to crop against — which an
     <img> with object-fit only approximates. The probe still gives us
     load/error state for the typeset fallback. */
  const [imageStatus, setImageStatus] = useState('loading'); // loading | ready | failed
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setImageStatus('ready');
    probe.onerror = () => setImageStatus('failed');
    probe.src = wordmark;
    return () => {
      probe.onload = null;
      probe.onerror = null;
    };
  }, [wordmark]);

  const imageFailed = imageStatus === 'failed';

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onStart();
  }, [onStart]);

  useEffect(() => {
    if (!returning) return;

    // Someone who has asked for reduced motion has asked not to sit through
    // this. Send them straight in.
    if (prefersReducedMotion()) {
      finish();
      return;
    }

    let frame;
    const started = performance.now();

    const tick = (now) => {
      const ratio = Math.min(1, (now - started) / DURATION);
      setProgress(ratio);
      if (ratio >= 1) finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // Any input skips the rest. The bar is a courtesy, not a toll.
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [returning, finish]);

  return (
    <div className="splash" data-returning={returning || undefined}>
      {/*
        Two layers now, not three:
          1. .splash-backdrop — the photograph, absolutely positioned to
             cover the entire viewport. Untouched by everything below —
             this is the piece that was already right.
          2. .splash-card — a solid, self-contained panel floating on top.
             Earlier this was a soft gradient fading the photo back to the
             page colour behind loose text; a gradient's contrast depends on
             exactly what is behind it, which is fragile, and it does not
             read as a considered piece of the design the way an actual box
             does. A solid card guarantees legibility outright and looks
             like it was drawn on purpose.
      */}
      <div
        className="splash-backdrop"
        style={imageStatus === 'ready' ? { backgroundImage: `url(${wordmark})` } : undefined}
        role="img"
        aria-label="Palletio"
      />

      <div className="splash-card">
        {/* Shown only as a fallback — with no photograph to be "the
            background", the name becomes the first line inside the card
            rather than a separate full-bleed element. */}
        {imageFailed && (
          <span className="splash-mark-fallback" aria-hidden="true">Palletio</span>
        )}

        {returning ? (
          <>
            <h1 className="splash-headline">Welcome back, you peacock</h1>

            <div
              className="splash-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label="Opening the generator"
            >
              <span className="splash-progress-fill" style={{ transform: `scaleX(${progress})` }} />
            </div>

            <button className="splash-skip" onClick={finish}>
              Skip
            </button>
          </>
        ) : (
          <>
            <h1 className="splash-headline">Make colour, not war</h1>

            <button className="splash-start" onClick={finish}>
              Start here
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M4 10h12M11 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <p className="splash-copy">
              {COPY.map((line, i) => <span key={i}>{line}</span>)}
            </p>
          </>
        )}
      </div>

      <span className="splash-version mono">{version}</span>
    </div>
  );
}
