import { getVibe, surfaceMap } from '../lib/vibes.js';
import { simulateCVD, bestTextOn, mix, hexToOklch, oklchToHex } from '../lib/color.js';
import { treatmentStyles } from '../lib/imagery.js';

/**
 * Previews.jsx — the sample layouts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why there is no scaling code here any more.
 *
 * These used to render at a fixed 1200px and shrink with a CSS transform.
 * That kept breaking, and it was never going to stop: `transform` changes
 * what an element *looks* like, not the box it occupies. A 1200px-wide child
 * still contributes 1200px to its ancestors' intrinsic width no matter how
 * far it has been scaled down, so any ancestor whose width depends on its
 * contents gets inflated — and then the measurement that drives the scale
 * comes back wrong, and nothing shrinks at all.
 *
 * Every fix for that is a patch on a mechanism that cannot be made reliable.
 * So the layouts are now genuinely fluid: the frame declares an aspect ratio
 * and becomes a container, and every dimension inside is expressed in `cqw`
 * — percentage of container width. A design drawn at 1200px wide simply
 * reads 56px type as `4.667cqw`.
 *
 * Nothing has a fixed pixel width, so nothing can overflow. The proportions
 * are identical at any size, no measurement is needed, and it works on a
 * phone.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Converts a dimension from the design grid into container-relative units. */
function scaler(base) {
  return (px) => `${((px / base) * 100).toFixed(4)}cqw`;
}

function Frame({ width, height, children, style }) {
  return (
    <div
      className="preview-frame"
      style={{ aspectRatio: `${width} / ${height}`, containerType: 'inline-size', ...style }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- image */

function TreatedImage({ image, treatment, map, style, strength = 1, creditColor, u }) {
  if (!image) return null;
  const { filter, layers } = treatmentStyles(treatment, {
    shadow: map.duotoneShadow || map.ink,
    highlight: map.duotoneHighlight || map.page,
    hero: map.hero,
    strength,
    useHighlight: map.useHighlight !== false,
  });

  return (
    <div className="image-layer" style={style}>
      <img src={image.url} alt="" style={{ filter }} loading="lazy" />
      {layers.map((layer, i) => (
        <span key={i} className="image-tint" style={layer} />
      ))}
      {/* On the image itself rather than only in the caption above it — the
          caption is chrome and would not survive an export. */}
      <span className="image-credit" style={{ color: creditColor, fontSize: u ? u(11) : 9 }}>
        {image.credit} / {image.sourceName || 'Unsplash'}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- ornament */

function Ornament({ vibe, map, cv, u }) {
  const c = (hex) => simulateCVD(hex, cv);

  if (vibe.shape === 'blob') {
    return (
      <svg
        viewBox="0 0 440 440"
        style={{ position: 'absolute', right: u(-60), top: u(-40), width: u(440), height: u(440) }}
      >
        <path fill={c(map.accent)} d="M352 88c34 40 46 100 30 150s-60 90-114 106-116 8-152-24-46-88-30-142S154 82 206 62s112-14 146 26Z" />
        <circle cx="140" cy="300" r="72" fill={c(map.accent2)} opacity="0.85" />
      </svg>
    );
  }

  if (vibe.shape === 'arc') {
    return (
      <svg
        viewBox="0 0 480 480"
        style={{ position: 'absolute', right: u(-110), top: u(-110), width: u(480), height: u(480) }}
      >
        <circle cx="240" cy="240" r="230" fill={c(map.accent)} />
        <circle cx="240" cy="240" r="150" fill={c(map.accent2)} />
        <circle cx="240" cy="240" r="72" fill={c(map.hero)} />
      </svg>
    );
  }

  if (vibe.shape === 'grid') {
    return (
      <div
        style={{
          position: 'absolute', right: u(56), top: u(96),
          display: 'grid', gridTemplateColumns: `repeat(3, ${u(84)})`, gap: u(8),
        }}
      >
        {[map.hero, map.accent, map.accent2, map.accent2, map.hero, map.accent, map.accent, map.accent2, map.hero].map((hex, i) => (
          <div key={i} style={{ height: u(84), background: c(hex), borderRadius: vibe.radius }} />
        ))}
      </div>
    );
  }

  if (vibe.shape === 'hairline') {
    return (
      <div style={{ position: 'absolute', right: u(56), top: u(88), width: u(340) }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            style={{
              height: u(2), marginBottom: u(14), width: `${100 - i * 8}%`,
              background: c(i % 3 === 0 ? map.hero : i % 3 === 1 ? map.accent : map.accent2),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', right: u(64), top: u(104), width: u(360) }}>
      <div style={{ height: u(260), background: c(map.accent), marginBottom: u(12) }} />
      <div style={{ height: u(3), background: c(map.ink), marginBottom: u(10) }} />
      <div style={{ display: 'flex', gap: u(8) }}>
        {[map.hero, map.accent2, map.ink].map((hex, i) => (
          <div key={i} style={{ flex: 1, height: u(44), background: c(hex) }} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------- landing: split view */

function HeroSplit({ map, vibe, cv, image, treatment, imageStrength, hardEdge }) {
  const u = scaler(1200);
  const c = (hex) => simulateCVD(hex, cv);
  const heroText = bestTextOn(map.hero, [map.page, map.ink, '#FFFFFF', '#000000']);
  const airy = vibe.density === 'airy';
  const pad = airy ? 72 : 56;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: c(map.page), color: c(map.ink),
        fontFamily: vibe.body, fontWeight: vibe.bodyWeight,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {image ? (
        <TreatedImage
          image={image} treatment={treatment} map={map}
          strength={imageStrength} creditColor={c(map.page)} u={u}
          style={{
            inset: '0 0 0 47%',
            /* A hard split is the honest version: a fade lays a wash of the
               page colour over the photograph, which is a treatment you did
               not ask for and cannot control. */
            ...(hardEdge ? {} : {
              maskImage: 'linear-gradient(90deg, transparent 0%, #000 20%)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 20%)',
            }),
          }}
        />
      ) : (
        <Ornament vibe={vibe} map={map} cv={cv} u={u} />
      )}

      <nav
        style={{
          display: 'flex', alignItems: 'center', gap: u(32),
          padding: `${u(28)} ${u(pad)}`, position: 'relative', zIndex: 2,
        }}
      >
        <span style={{ fontFamily: vibe.display, fontWeight: vibe.displayWeight, fontSize: u(20), letterSpacing: vibe.displayTracking }}>
          Northbank
        </span>
        {['Work', 'Studio', 'Journal'].map((item) => (
          <span key={item} style={{ fontSize: u(14), opacity: 0.72 }}>{item}</span>
        ))}
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: u(13), padding: `${u(9)} ${u(18)}`, borderRadius: vibe.radius,
            background: c(map.hero), color: c(heroText), fontWeight: 500,
          }}
        >
          Get in touch
        </span>
      </nav>

      <div style={{ padding: `${u(24)} ${u(pad)} 0`, width: '47%', position: 'relative', zIndex: 2, flex: 1 }}>
        <div
          style={{
            display: 'inline-block', fontFamily: vibe.mono, fontSize: u(11),
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: `${u(5)} ${u(12)}`, borderRadius: vibe.radius,
            background: c(map.surface), color: c(map.ink), marginBottom: u(20),
          }}
        >
          Independent since 2014
        </div>

        <h1
          style={{
            fontFamily: vibe.display, fontWeight: vibe.displayWeight,
            fontSize: u(54 * vibe.heroScale), lineHeight: 1.02,
            letterSpacing: vibe.displayTracking, margin: `0 0 ${u(20)}`,
          }}
        >
          Colour that survives<br />
          <span style={{ color: c(map.hero) }}>contact with reality</span>
        </h1>

        <p style={{ fontSize: u(16), lineHeight: 1.5, opacity: 0.78, margin: `0 0 ${u(26)}` }}>
          A palette looks fine in isolation and falls apart the moment it has to carry a button,
          a caption and a body of text.
        </p>

        <div style={{ display: 'flex', gap: u(12), alignItems: 'center' }}>
          <span style={{ padding: `${u(13)} ${u(26)}`, borderRadius: vibe.radius, background: c(map.hero), color: c(heroText), fontWeight: 500, fontSize: u(15) }}>
            Start a project
          </span>
          <span style={{ padding: `${u(12)} ${u(24)}`, borderRadius: vibe.radius, border: `${u(1.5)} solid ${c(map.ink)}`, fontSize: u(15), fontWeight: 500 }}>
            See the work
          </span>
        </div>
      </div>

      <div
        style={{
          padding: `${u(18)} ${u(pad)}`, background: c(map.surface),
          display: 'flex', gap: u(40), alignItems: 'center',
          fontFamily: vibe.mono, fontSize: u(12), letterSpacing: '0.08em',
          textTransform: 'uppercase', opacity: 0.85, zIndex: 2, position: 'relative',
        }}
      >
        {['Brand', 'Motion', 'Editorial', 'Type'].map((x) => <span key={x}>{x}</span>)}
        <span style={{ flex: 1 }} />
        <span style={{ color: c(map.hero) }}>Glasgow</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------- landing: statement view */

/**
 * Type and colour only — no photography, no ornament.
 *
 * This is the harder test of a palette, and the one most brand systems
 * actually face: a flat field of one colour, a headline sitting directly on
 * it, and a row of cards that each have to hold their own text. There is
 * nowhere for a weak colour to hide. If a palette works here it will work
 * anywhere; a photograph can rescue a palette that cannot do this.
 */
function HeroStatement({ map, vibe, cv }) {
  const u = scaler(1200);
  const c = (hex) => simulateCVD(hex, cv);

  const onHero = bestTextOn(map.hero, [map.ink, map.page, '#FFFFFF', '#000000']);
  const ctaBg = map.ink;
  const ctaText = bestTextOn(ctaBg, [map.page, map.hero, '#FFFFFF', '#000000']);

  /* Three cards, each a different surface, because a card row is where a
     palette's mid-range gets tested — and most palettes have exactly one
     colour that works there. */
  const cards = [
    { bg: map.ink, title: 'Built to be legible', body: 'Every pairing checked against WCAG and APCA before it reaches a layout.' },
    { bg: map.accent, title: 'Roles, not swatches', body: 'Hero, accent, neutral — the system knows which colour does which job.' },
    { bg: map.accent2 === map.accent ? map.surface : map.accent2, title: 'Tested at size', body: 'From a hero headline down to a sixteen-pixel favicon.' },
  ];

  return (
    <div
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        fontFamily: vibe.body, fontWeight: vibe.bodyWeight,
        background: c(map.page), display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Flat colour field, no gradient anywhere. */}
      <div style={{ position: 'absolute', inset: `0 0 34% 0`, background: c(map.hero) }} />

      <nav
        style={{
          display: 'flex', alignItems: 'center', gap: u(30),
          padding: `${u(24)} ${u(56)}`, position: 'relative', zIndex: 2, color: c(onHero),
        }}
      >
        <span style={{ fontFamily: vibe.display, fontWeight: vibe.displayWeight, fontSize: u(21), letterSpacing: vibe.displayTracking }}>
          Northbank
        </span>
        {['Personal', 'Studio', 'Platform'].map((item) => (
          <span key={item} style={{ fontSize: u(14), opacity: 0.8 }}>{item}</span>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: u(14), opacity: 0.8 }}>Log in</span>
        <span
          style={{
            fontSize: u(13), padding: `${u(8)} ${u(18)}`, borderRadius: vibe.radius,
            background: c(ctaBg), color: c(ctaText), fontWeight: 500,
          }}
        >
          Sign up
        </span>
      </nav>

      <div
        style={{
          position: 'relative', zIndex: 2, textAlign: 'center',
          padding: `${u(24)} ${u(100)} 0`, color: c(onHero),
        }}
      >
        <h1
          style={{
            fontFamily: vibe.display, fontWeight: vibe.displayWeight,
            fontSize: u(66 * vibe.heroScale), lineHeight: 0.94,
            letterSpacing: vibe.displayTracking, textTransform: 'uppercase',
            margin: `0 0 ${u(16)}`,
          }}
        >
          A palette that<br />holds its nerve
        </h1>

        <p style={{ fontSize: u(16), fontWeight: 500, opacity: 0.85, margin: `0 0 ${u(20)}` }}>
          No photography to hide behind. Just colour, type and the space between them.
        </p>

        <div style={{ display: 'flex', gap: u(20), alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ padding: `${u(13)} ${u(28)}`, borderRadius: vibe.radius, background: c(ctaBg), color: c(ctaText), fontWeight: 500, fontSize: u(15) }}>
            Open the system
          </span>
          <span style={{ fontSize: u(15), fontWeight: 500, borderBottom: `${u(2)} solid currentColor`, paddingBottom: u(2) }}>
            See it in use
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Cards straddle the colour boundary — the composition device that
          makes this layout worth testing, since each card has to work
          against two different grounds at once. */}
      <div
        style={{
          position: 'relative', zIndex: 2, display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)', gap: u(20),
          padding: `0 ${u(56)} ${u(28)}`,
        }}
      >
        {cards.map((card, i) => {
          const fg = bestTextOn(card.bg, [map.page, map.ink, '#FFFFFF', '#000000']);
          return (
            <div
              key={i}
              style={{
                background: c(card.bg), color: c(fg),
                borderRadius: vibe.radiusCard, padding: u(22),
                display: 'grid', gap: u(8), alignContent: 'start',
                minHeight: u(150),
              }}
            >
              <span style={{ fontFamily: vibe.display, fontWeight: vibe.displayWeight, fontSize: u(19), letterSpacing: vibe.displayTracking }}>
                {card.title}
              </span>
              <span style={{ fontSize: u(13.5), lineHeight: 1.45, opacity: 0.82 }}>{card.body}</span>
              <span style={{ fontSize: u(13), fontWeight: 500, borderBottom: `${u(1.5)} solid currentColor`, justifySelf: 'start', marginTop: u(2) }}>
                Find out more
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- social post */

function SocialPreview({ map, vibe, cv, image, treatment, imageStrength }) {
  const u = scaler(432);
  const c = (hex) => simulateCVD(hex, cv);
  const onHero = bestTextOn(map.hero, [map.page, map.ink, '#FFFFFF', '#000000']);

  return (
    <div
      style={{
        width: '100%', height: '100%', background: c(map.hero), color: c(onHero),
        fontFamily: vibe.body, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {image ? (
        <>
          <TreatedImage
            image={image} treatment={treatment} map={map}
            strength={imageStrength} creditColor={c(onHero)} u={u}
          />
          {/* Contrast maths assumes a flat ground; a photograph is not one.
              A pairing can score 12:1 against the average and still be
              unreadable over one bright patch. */}
          <span
            style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(180deg, ${c(map.hero)} 10%, transparent 56%, ${c(map.hero)} 96%)`,
              opacity: 0.9,
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: 'absolute', width: u(300), height: u(300),
            borderRadius: vibe.shape === 'blob' || vibe.shape === 'arc' ? '50%' : vibe.radiusCard,
            background: c(map.accent), right: u(-90), bottom: u(-90), opacity: 0.9,
          }}
        />
      )}

      <div style={{ padding: u(36), position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontFamily: vibe.mono, fontSize: u(11), letterSpacing: '0.14em',
            textTransform: 'uppercase', opacity: 0.8, marginBottom: u(14),
          }}
        >
          New work
        </div>

        <h2
          style={{
            fontFamily: vibe.display, fontWeight: vibe.displayWeight,
            fontSize: u(44 * vibe.heroScale), lineHeight: 1.03,
            letterSpacing: vibe.displayTracking, margin: `0 0 ${u(16)}`,
          }}
        >
          Nine colours,<br />one decision.
        </h2>

        <p style={{ fontSize: u(15), lineHeight: 1.5, opacity: 0.85, margin: 0, maxWidth: '72%' }}>
          An identity system for a lighting studio at the end of the continent, built from weather
          data and a single warm neutral.
        </p>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: u(16), borderTop: `${u(1)} solid ${c(onHero)}33`,
            fontSize: u(12), fontFamily: vibe.mono, letterSpacing: '0.06em',
          }}
        >
          <span>@studio</span>
          <span style={{ opacity: 0.7 }}>Case study in bio</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- UI kit */

function UIKitPreview({ map, vibe, cv }) {
  const u = scaler(560);
  const c = (hex) => simulateCVD(hex, cv);
  const onHero = bestTextOn(map.hero, [map.page, map.ink, '#FFFFFF', '#000000']);
  const subtle = mix(map.page, map.ink, 0.06);
  const border = mix(map.page, map.ink, 0.16);

  const heroL = hexToOklch(map.hero).L;
  const heroHover = oklchToHex({ ...hexToOklch(map.hero), L: heroL > 0.5 ? heroL - 0.07 : heroL + 0.07 });

  return (
    <div
      style={{
        width: '100%', height: '100%', background: c(map.page), color: c(map.ink),
        fontFamily: vibe.body, padding: u(30), display: 'grid', gap: u(20),
        alignContent: 'start', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: u(10), flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ padding: `${u(10)} ${u(20)}`, borderRadius: vibe.radius, background: c(map.hero), color: c(onHero), fontSize: u(14), fontWeight: 500 }}>Primary</span>
        <span style={{ padding: `${u(10)} ${u(20)}`, borderRadius: vibe.radius, background: c(heroHover), color: c(onHero), fontSize: u(14), fontWeight: 500 }}>Hover</span>
        <span style={{ padding: `${u(9)} ${u(19)}`, borderRadius: vibe.radius, border: `${u(1.5)} solid ${c(border)}`, fontSize: u(14), fontWeight: 500 }}>Secondary</span>
        <span style={{ padding: `${u(10)} ${u(20)}`, borderRadius: vibe.radius, background: c(subtle), fontSize: u(14), fontWeight: 500 }}>Subtle</span>
        <span style={{ padding: `${u(10)} ${u(20)}`, borderRadius: vibe.radius, background: c(subtle), color: c(map.ink), fontSize: u(14), opacity: 0.4 }}>Disabled</span>
      </div>

      <div style={{ display: 'grid', gap: u(8) }}>
        <span style={{ fontSize: u(12), opacity: 0.7 }}>Email address</span>
        <div style={{ padding: `${u(11)} ${u(14)}`, borderRadius: vibe.radiusCard, border: `${u(1.5)} solid ${c(border)}`, background: c(map.surface), fontSize: u(14), opacity: 0.55 }}>
          you@studio.com
        </div>
        <div style={{ padding: `${u(11)} ${u(14)}`, borderRadius: vibe.radiusCard, border: `${u(2)} solid ${c(map.hero)}`, background: c(map.surface), fontSize: u(14) }}>
          hello@studio.com
        </div>
      </div>

      <div style={{ display: 'flex', gap: u(8), flexWrap: 'wrap' }}>
        {map.all.slice(0, 5).map((hex, i) => (
          <span
            key={i}
            style={{
              padding: `${u(4)} ${u(12)}`, borderRadius: u(999), background: c(hex),
              color: c(bestTextOn(hex, [map.ink, map.page, '#FFFFFF', '#000000'])),
              fontSize: u(12), fontWeight: 500,
            }}
          >
            Label {i + 1}
          </span>
        ))}
      </div>

      <div style={{ padding: u(20), borderRadius: vibe.radiusCard, background: c(map.surface), border: `${u(1)} solid ${c(border)}`, display: 'grid', gap: u(8) }}>
        <span style={{ fontFamily: vibe.display, fontWeight: vibe.displayWeight, fontSize: u(20), letterSpacing: vibe.displayTracking }}>
          Card heading
        </span>
        <span style={{ fontSize: u(14), lineHeight: 1.55, opacity: 0.75 }}>
          Body copy at the size it will actually be read. If this is uncomfortable here, no amount
          of contrast score is going to save it in production.
        </span>
        <span style={{ fontSize: u(14), color: c(map.hero), fontWeight: 500 }}>A text link →</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ exported */

export const LANDING_LAYOUTS = [
  { id: 'split', label: 'Split', note: 'Type on the left, image or ornament on the right' },
  { id: 'statement', label: 'Statement', note: 'Flat colour, centred type, card row — no imagery' },
];

export default function Previews({
  colors, roles, vibeId, cvd,
  image, treatment, imageStrength = 1, overrideMap,
  layout = 'split', hardEdge = false,
}) {
  const vibe = getVibe(vibeId);
  const map = overrideMap || surfaceMap(colors, roles);

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

  const usesImage = layout === 'split' && image;

  return (
    <div className="preview-stage">
      <div>
        <div className="preview-caption">
          <span className="preview-caption-title">Landing page</span>
          <span className="preview-caption-note">
            {LANDING_LAYOUTS.find((l) => l.id === layout)?.label} · 1200 × 680 proportions
            {usesImage && ` · photo: ${image.credit}`}
          </span>
        </div>
        <Frame width={1200} height={680}>
          {layout === 'statement' ? (
            <HeroStatement map={map} vibe={vibe} cv={cvd} />
          ) : (
            <HeroSplit
              map={map} vibe={vibe} cv={cvd}
              image={image} treatment={treatment}
              imageStrength={imageStrength} hardEdge={hardEdge}
            />
          )}
        </Frame>
      </div>

      <div className="preview-split">
        <div>
          <div className="preview-caption">
            <span className="preview-caption-title">Interface elements</span>
            <span className="preview-caption-note">Buttons, fields, states, links</span>
          </div>
          <Frame width={560} height={470}>
            <UIKitPreview map={map} vibe={vibe} cv={cvd} />
          </Frame>
        </div>

        <div>
          <div className="preview-caption">
            <span className="preview-caption-title">Social post</span>
            <span className="preview-caption-note">4:5</span>
          </div>
          <Frame width={432} height={540}>
            <SocialPreview
              map={map} vibe={vibe} cv={cvd}
              image={image} treatment={treatment} imageStrength={imageStrength}
            />
          </Frame>
        </div>
      </div>
    </div>
  );
}

export { HeroSplit, HeroStatement, SocialPreview, UIKitPreview };
