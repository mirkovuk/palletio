import { useState, useRef, useEffect } from 'react';
import { getVibe, surfaceMap } from '../lib/vibes.js';
import { simulateCVD, bestTextOn, mix, hexToOklch, oklchToHex } from '../lib/color.js';
import { treatmentStyles } from '../lib/imagery.js';

/**
 * Previews render at a fixed design size and scale to fit. Laying them out
 * responsively would mean the preview reflows differently from the thing it is
 * previewing, which defeats the purpose — you need to see the colours at the
 * proportions they will actually occupy.
 */
function Scaled({ width, height, children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: height * scale, overflow: 'hidden' }}>
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A photograph, treated so it contributes composition without contributing
 * colour. The duotone is built from CSS blend modes rather than canvas, which
 * avoids a CORS round trip on every image and keeps it live as the palette
 * changes.
 */
function TreatedImage({ image, treatment, map, style }) {
  if (!image) return null;
  const { filter, layers } = treatmentStyles(treatment, {
    shadow: map.ink,
    highlight: map.page,
    hero: map.hero,
  });

  return (
    <div className="image-layer" style={style}>
      <img src={image.url} alt="" style={{ filter }} loading="lazy" />
      {layers.map((layer, i) => (
        <span key={i} className="image-tint" style={layer} />
      ))}
    </div>
  );
}

/** Shape language per vibe — the same colours read very differently in each. */
function Ornament({ vibe, map, cv }) {
  const c = (hex) => simulateCVD(hex, cv);

  if (vibe.shape === 'blob') {
    return (
      <svg width="440" height="440" viewBox="0 0 440 440" style={{ position: 'absolute', right: -60, top: -40 }}>
        <path
          fill={c(map.accent)}
          d="M352 88c34 40 46 100 30 150s-60 90-114 106-116 8-152-24-46-88-30-142S154 82 206 62s112-14 146 26Z"
        />
        <circle cx="140" cy="300" r="72" fill={c(map.accent2)} opacity="0.85" />
      </svg>
    );
  }

  if (vibe.shape === 'arc') {
    return (
      <svg width="480" height="480" viewBox="0 0 480 480" style={{ position: 'absolute', right: -110, top: -110 }}>
        <circle cx="240" cy="240" r="230" fill={c(map.accent)} />
        <circle cx="240" cy="240" r="150" fill={c(map.accent2)} />
        <circle cx="240" cy="240" r="72" fill={c(map.hero)} />
      </svg>
    );
  }

  if (vibe.shape === 'grid') {
    return (
      <div style={{ position: 'absolute', right: 56, top: 96, display: 'grid', gridTemplateColumns: 'repeat(3, 84px)', gap: 8 }}>
        {[map.hero, map.accent, map.accent2, map.accent2, map.hero, map.accent, map.accent, map.accent2, map.hero].map((hex, i) => (
          <div key={i} style={{ height: 84, background: c(hex), borderRadius: vibe.radius }} />
        ))}
      </div>
    );
  }

  if (vibe.shape === 'hairline') {
    return (
      <div style={{ position: 'absolute', right: 56, top: 88, width: 340 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            style={{
              height: 2,
              marginBottom: 14,
              width: `${100 - i * 8}%`,
              background: c(i % 3 === 0 ? map.hero : i % 3 === 1 ? map.accent : map.accent2),
            }}
          />
        ))}
      </div>
    );
  }

  // 'rule' — editorial
  return (
    <div style={{ position: 'absolute', right: 64, top: 104, width: 360 }}>
      <div style={{ height: 260, background: c(map.accent), marginBottom: 12 }} />
      <div style={{ height: 3, background: c(map.ink), marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[map.hero, map.accent2, map.ink].map((hex, i) => (
          <div key={i} style={{ flex: 1, height: 44, background: c(hex) }} />
        ))}
      </div>
    </div>
  );
}

function HeroPreview({ map, vibe, cv, image, treatment }) {
  const c = (hex) => simulateCVD(hex, cv);
  const heroText = bestTextOn(map.hero, [map.page, map.ink, '#FFFFFF', '#000000']);
  const airy = vibe.density === 'airy';

  return (
    <div
      style={{
        width: 1200,
        height: 680,
        background: c(map.page),
        color: c(map.ink),
        fontFamily: vibe.body,
        fontWeight: vibe.bodyWeight,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {image ? (
        <TreatedImage
          image={image}
          treatment={treatment}
          map={map}
          style={{ left: '52%', right: 0, top: 0, bottom: 0, inset: 'auto' }}
        />
      ) : (
        <Ornament vibe={vibe} map={map} cv={cv} />
      )}

      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          padding: `28px ${airy ? 72 : 56}px`,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <span style={{ fontFamily: vibe.display, fontWeight: vibe.displayWeight, fontSize: 20, letterSpacing: vibe.displayTracking }}>
          Northbank
        </span>
        <span style={{ fontSize: 14, opacity: 0.72 }}>Work</span>
        <span style={{ fontSize: 14, opacity: 0.72 }}>Studio</span>
        <span style={{ fontSize: 14, opacity: 0.72 }}>Journal</span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 13,
            padding: '9px 18px',
            borderRadius: vibe.radius,
            background: c(map.hero),
            color: c(heroText),
            fontWeight: 500,
          }}
        >
          Get in touch
        </span>
      </nav>

      <div style={{ padding: `${airy ? 64 : 40}px ${airy ? 72 : 56}px`, maxWidth: 620, position: 'relative', zIndex: 2 }}>
        <div
          style={{
            display: 'inline-block',
            fontFamily: vibe.mono,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: '5px 12px',
            borderRadius: vibe.radius,
            background: c(map.surface),
            color: c(map.ink),
            marginBottom: 28,
          }}
        >
          Independent since 2014
        </div>

        <h1
          style={{
            fontFamily: vibe.display,
            fontWeight: vibe.displayWeight,
            fontSize: 64 * vibe.heroScale,
            lineHeight: 1.02,
            letterSpacing: vibe.displayTracking,
            margin: '0 0 24px',
          }}
        >
          Colour that survives
          <br />
          <span style={{ color: c(map.hero) }}>contact with reality</span>
        </h1>

        <p style={{ fontSize: 18, lineHeight: 1.55, opacity: 0.78, margin: '0 0 36px', maxWidth: 460 }}>
          A palette looks fine in isolation and falls apart the moment it has to carry a button, a
          caption and a body of text. This is what yours does under load.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            style={{
              padding: '14px 28px',
              borderRadius: vibe.radius,
              background: c(map.hero),
              color: c(heroText),
              fontWeight: 500,
              fontSize: 15,
            }}
          >
            Start a project
          </span>
          <span
            style={{
              padding: '13px 26px',
              borderRadius: vibe.radius,
              border: `1.5px solid ${c(map.ink)}`,
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            See the work
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: `20px ${airy ? 72 : 56}px`,
          background: c(map.surface),
          display: 'flex',
          gap: 40,
          alignItems: 'center',
          fontFamily: vibe.mono,
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.85,
          zIndex: 2,
        }}
      >
        <span>Brand</span><span>Motion</span><span>Editorial</span><span>Type</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: c(map.hero) }}>Glasgow</span>
      </div>
    </div>
  );
}

function SocialPreview({ map, vibe, cv, image, treatment }) {
  const c = (hex) => simulateCVD(hex, cv);
  const onHero = bestTextOn(map.hero, [map.page, map.ink, '#FFFFFF', '#000000']);

  return (
    <div
      style={{
        width: 432,
        height: 540,
        background: c(map.hero),
        color: c(onHero),
        fontFamily: vibe.body,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {image ? (
        <TreatedImage image={image} treatment={treatment} map={map} style={{ opacity: 0.85 }} />
      ) : (
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: vibe.shape === 'blob' || vibe.shape === 'arc' ? '50%' : vibe.radius,
            background: c(map.accent),
            right: -90,
            bottom: -90,
            opacity: 0.9,
          }}
        />
      )}

      <div style={{ padding: 36, position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontFamily: vibe.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            opacity: 0.8,
          }}
        >
          New work
        </div>

        <div style={{ flex: 1 }} />

        <h2
          style={{
            fontFamily: vibe.display,
            fontWeight: vibe.displayWeight,
            fontSize: 46 * vibe.heroScale,
            lineHeight: 1.03,
            letterSpacing: vibe.displayTracking,
            margin: '0 0 18px',
          }}
        >
          Nine colours,
          <br />
          one decision.
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.85, margin: '0 0 28px', maxWidth: 300 }}>
          An identity system for a lighting studio at the end of the continent, built from weather
          data and a single warm neutral.
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {map.all.slice(0, 8).map((hex, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 28,
                background: c(hex),
                borderRadius: vibe.radius === '999px' ? '999px' : vibe.radius,
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 16,
            borderTop: `1px solid ${c(onHero)}33`,
            fontSize: 12,
            fontFamily: vibe.mono,
            letterSpacing: '0.06em',
          }}
        >
          <span>@studio</span>
          <span style={{ opacity: 0.7 }}>Case study in bio</span>
        </div>
      </div>
    </div>
  );
}

function UIKitPreview({ map, vibe, cv }) {
  const c = (hex) => simulateCVD(hex, cv);
  const onHero = bestTextOn(map.hero, [map.page, map.ink, '#FFFFFF', '#000000']);
  const subtle = mix(map.page, map.ink, 0.06);
  const border = mix(map.page, map.ink, 0.16);

  const heroLight = hexToOklch(map.hero).L;
  const heroHover = oklchToHex({
    ...hexToOklch(map.hero),
    L: heroLight > 0.5 ? heroLight - 0.07 : heroLight + 0.07,
  });

  return (
    <div
      style={{
        width: 560,
        background: c(map.page),
        color: c(map.ink),
        fontFamily: vibe.body,
        padding: 32,
        display: 'grid',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ padding: '10px 20px', borderRadius: vibe.radius, background: c(map.hero), color: c(onHero), fontSize: 14, fontWeight: 500 }}>
          Primary
        </span>
        <span style={{ padding: '10px 20px', borderRadius: vibe.radius, background: c(heroHover), color: c(onHero), fontSize: 14, fontWeight: 500 }}>
          Hover
        </span>
        <span style={{ padding: '9px 19px', borderRadius: vibe.radius, border: `1.5px solid ${c(border)}`, fontSize: 14, fontWeight: 500 }}>
          Secondary
        </span>
        <span style={{ padding: '10px 20px', borderRadius: vibe.radius, background: c(subtle), fontSize: 14, fontWeight: 500 }}>
          Subtle
        </span>
        <span style={{ padding: '10px 20px', borderRadius: vibe.radius, background: c(subtle), color: c(map.ink), fontSize: 14, opacity: 0.4 }}>
          Disabled
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Email address</span>
        <div style={{ padding: '11px 14px', borderRadius: vibe.radius, border: `1.5px solid ${c(border)}`, background: c(map.surface), fontSize: 14, opacity: 0.55 }}>
          you@studio.com
        </div>
        <div style={{ padding: '11px 14px', borderRadius: vibe.radius, border: `2px solid ${c(map.hero)}`, background: c(map.surface), fontSize: 14 }}>
          mirko@studio.com
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {map.all.slice(0, 5).map((hex, i) => (
          <span
            key={i}
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              background: c(hex),
              color: c(bestTextOn(hex, [map.ink, map.page, '#FFFFFF', '#000000'])),
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Label {i + 1}
          </span>
        ))}
      </div>

      <div style={{ padding: 20, borderRadius: vibe.radius, background: c(map.surface), border: `1px solid ${c(border)}`, display: 'grid', gap: 8 }}>
        <span style={{ fontFamily: vibe.display, fontWeight: vibe.displayWeight, fontSize: 20, letterSpacing: vibe.displayTracking }}>
          Card heading
        </span>
        <span style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.75 }}>
          Body copy at the size it will actually be read. If this is uncomfortable here, no amount of
          contrast score is going to save it in production.
        </span>
        <span style={{ fontSize: 14, color: c(map.hero), fontWeight: 500 }}>A text link →</span>
      </div>
    </div>
  );
}

export default function Previews({
  colors, roles, vibeId, onVibeChange, cvd, onCvdChange, image, treatment,
}) {
  const vibe = getVibe(vibeId);
  const map = surfaceMap(colors, roles);

  if (colors.length < 3) {
    return (
      <div className="empty">
        <div className="empty-title">Add a few more colours</div>
        <p className="empty-note">
          The samples need at least a background, a text colour and something to lead with — three
          colours minimum before they tell you anything useful.
        </p>
      </div>
    );
  }

  return (
    <div className="preview-stage">
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">Landing page</span>
          <span className="preview-caption-note">
            1200 × 680 — scaled to fit
            {image && ` · photo: ${image.credit}`}
          </span>
        </div>
        <div className="preview-frame">
          <Scaled width={1200} height={680}>
            <HeroPreview map={map} vibe={vibe} cv={cvd} image={image} treatment={treatment} />
          </Scaled>
        </div>
      </div>

      <div className="preview-split">
        <div>
          <div className="preview-caption">
            <span className="preview-caption-title">Interface elements</span>
            <span className="preview-caption-note">Buttons, fields, states, links</span>
          </div>
          <div className="preview-frame">
            <Scaled width={560} height={580}>
              <UIKitPreview map={map} vibe={vibe} cv={cvd} />
            </Scaled>
          </div>
        </div>

        <div>
          <div className="preview-caption">
            <span className="preview-caption-title">Social post</span>
            <span className="preview-caption-note">4:5</span>
          </div>
          <div className="preview-frame">
            <Scaled width={432} height={540}>
              <SocialPreview map={map} vibe={vibe} cv={cvd} image={image} treatment={treatment} />
            </Scaled>
          </div>
        </div>
      </div>
    </div>
  );
}

export { HeroPreview, SocialPreview, UIKitPreview, Scaled };
