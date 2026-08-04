# Palletio

Build a colour palette, find what's working against itself, test every pairing
for contrast, assign roles, and see it in use.

Runs entirely in the browser. No account, no server, no database. Deploys to
GitHub Pages.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

## Deploying

1. Push to a GitHub repo named `palletio`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes.

If the repo has a different name, change `GITHUB_PAGES_BASE` in the workflow
and `base` in `vite.config.js` to match. For a custom domain or a
`username.github.io` repo, set both to `/`.

---

## Architecture

```
src/
  lib/            Pure functions. No React, no DOM, no styling.
    color.js        sRGB ↔ OKLCH, WCAG, APCA, colour-vision simulation
    harmony.js      Outlier detection, metrics, health score
    suggest.js      Neutral and harmony generation
    roles.js        Role inference, pairing matrix
    extract.js      Image / CSS / file / URL extraction
    exporters.js    CSS, SCSS, Tailwind, JSON, SVG, PNG, ASE, share links
    vibes.js        Typographic presets for the sample layouts
    logo.js         Mark data, SVG sanitising, fill remapping
    brief.js        Brand brief → palette, and settings storage
  components/     React. Presentation only.
  styles/
    tokens.css      ← the reskin surface
    app.css         Component styles, built entirely on tokens
```

The split is deliberate: **`lib/` never imports from `components/`.** A complete
visual rebuild can't break the colour maths, and the maths can be tested in Node
without a browser.

### Why OKLCH rather than HSL

HSL's lightness isn't perceptual. `#FFFF00` and `#0000FF` are both 50% lightness
in HSL — one is blinding, one is nearly black. Any judgement about "too dark" or
"too vibrant" built on HSL is wrong for about half the hue wheel, and any
generated tint or shade shifts hue as it goes. OKLab fixes both, which matters
most in exactly the places a palette tool is expected to be useful.

### Reskinning

Rewrite `src/styles/tokens.css`. Nothing in `components/` hardcodes a colour,
size, radius or type value — everything reads from a semantic token, and
selectors are kept to single classes so overrides never need `!important`.

One decision worth keeping when the Figma lands: **the interface is achromatic
on purpose.** Every hue on screen belongs to the palette being evaluated.
Simultaneous contrast means a saturated button beside a swatch changes how that
swatch is perceived, and a tool for judging colour can't afford to misrepresent
the thing it's judging. If brand colour comes into the chrome, keep it out of
the areas immediately adjacent to swatches and previews — the rail, header and
buttons are safe; the canvas isn't.

---

## The logo test

Lives at the bottom of step 5. Three things a pairing table can't tell you:

- **Size ramp** — the mark at 96/48/32/16px on a chosen ground. Contrast that
  reads fine on a headline can dissolve at favicon size.
- **One-colour reduction** — the mark flattened to a single colour, both ways
  round. If it loses structure here, it's carrying meaning in colour that the
  form should be carrying: fax, embroidery, engraving, single-colour print,
  and anywhere it's used as a mask.
- **Combination matrix** — every mark/ground pair with its ratio. Click any
  tile to load it into the size ramp.

Upload a real `.svg` and its fills are detected and mapped onto palette colours
individually. Uploaded files are sanitised before they touch the DOM — scripts,
event handlers, `foreignObject` and external references are stripped.

WCAG exempts logotypes, so the ratios here are legibility guidance rather than
compliance. Below roughly 3:1 a mark stops holding its shape at small sizes.

## The worker (optional)

Two things a static site can't do on its own. Both are handled by a small
Cloudflare Worker in `worker/`, and everything else in the app works without it.

**Reading colours off a live website.** Browsers block cross-origin fetches —
that's a security rule, not a gap in the tool. Without the worker, use the Image
tab (drop a screenshot) or the Paste Source tab. Both work with no setup.

**Brand brief → palette.** Needs an Anthropic API key. The worker keeps it
server-side. The alternative — pasting a key into Settings — stores it in
`localStorage`, where any script on the page can read it. Fine on your own
machine, not fine for a link you send a client.

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler deploy
wrangler secret put ANTHROPIC_API_KEY    # only for the brief feature
```

Add your Pages address to `ALLOWED_ORIGINS` in `worker/index.js` before
deploying, or you're running an open proxy on your account. Then paste the
worker address into Settings.

---

## Notes on the contrast standards

**WCAG 2.1** compares relative luminance and returns a ratio. It's what
accessibility law and audits refer to, so it's the number to quote. It's also
known to be unreliable at the dark end.

**APCA** returns Lc (roughly −108 to 106) and accounts for text size, weight and
polarity. Roughly: 60 for large text, 75 for body, 90 for anything small. It's a
candidate for WCAG 3, not a current requirement.

They disagree most on light text over mid-tone colour, which is where most brand
palettes actually get used. Trust APCA for the design decision, report WCAG for
the audit.

## Known limits

- **Screen only.** No CMYK, no spot colours, no ICC profiles. `.ase` files
  containing CMYK swatches are converted naively on import.
- **Saved palettes are per-browser.** Clearing site data clears them. Share
  links carry the whole palette in the URL hash, so they survive independently.
- **The eyedropper needs Chrome or Edge.** The button hides itself elsewhere.
