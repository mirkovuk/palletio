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
  const [imageFailed, setImageFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

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
      {/* Full-bleed: a direct child of .splash rather than of the padded,
          max-width .splash-inner column below, so the image can run edge to
          edge while the headline and copy stay in a readable measure. */}
      <div className="splash-mark">
        {/* The typeset version is what someone on a slow connection sees
            first, so it has to look deliberate rather than like a
            placeholder waiting to be replaced. It keeps the same padded
            width as the text column, since a full-bleed line of giant serif
            type (rather than a shaped wordmark) has no natural edge to run
            to. */}
        {imageFailed ? (
          <span className="splash-mark-fallback" aria-hidden="true">Palletio</span>
        ) : (
          <img
            src={wordmark}
            alt="Palletio"
            className="splash-mark-image"
            fetchPriority="high"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
        {imageFailed && <span className="visually-hidden">Palletio</span>}
      </div>

      <div className="splash-inner">
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
