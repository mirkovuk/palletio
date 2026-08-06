/**
 * Optional Cloudflare Worker for Palletio.
 *
 * Two jobs, both of which a static site cannot do on its own:
 *
 *   GET  /?url=https://example.com   fetches a page so colours can be read
 *                                    out of its markup and stylesheets
 *   POST /palette                    calls Anthropic with a key that stays
 *                                    server-side, never reaching the browser
 *
 * Deploy:
 *   npm install -g wrangler
 *   wrangler login
 *   wrangler deploy
 *   wrangler secret put ANTHROPIC_API_KEY     # only for the brief feature
 *
 * Then paste the resulting address into Settings in the app.
 */

// Lock this down to your own Pages address before deploying anywhere public,
// otherwise you are running an open proxy on your account.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  // 'https://your-name.github.io',
];

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    /* ---- imagery ------------------------------------------------------ */

    /**
     * Unsplash search with the key held here rather than in the browser.
     * This is the only arrangement where every visitor gets real imagery —
     * a key entered in Settings lives in one person's localStorage.
     *
     * Note this spends YOUR Unsplash quota on everyone's behalf. Demo tier
     * is 50 requests an hour across all visitors, which a handful of testers
     * will exhaust. Apply for production access (5,000/hour) before opening
     * it up widely.
     */
    if (url.pathname === '/images' && request.method === 'GET') {
      if (!env.UNSPLASH_ACCESS_KEY) {
        return Response.json({ error: 'No Unsplash key configured.' }, { status: 500, headers });
      }

      const params = new URLSearchParams({
        query: url.searchParams.get('query') || 'abstract texture',
        per_page: '12',
        orientation: 'landscape',
        content_filter: 'high',
      });
      const color = url.searchParams.get('color');
      if (color) params.set('color', color);

      const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
        headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` },
      });

      if (!res.ok) {
        return Response.json(
          { error: `Unsplash returned ${res.status}` },
          { status: res.status === 403 ? 429 : 502, headers }
        );
      }

      const data = await res.json();
      const utm = 'utm_source=palletio&utm_medium=referral';
      const tag = (u) => (u ? u + (u.includes('?') ? '&' : '?') + utm : u);

      const images = (data.results || []).map((photo) => ({
        id: photo.id,
        url: photo.urls.regular,
        thumb: photo.urls.thumb,
        credit: photo.user?.name || 'Unsplash',
        creditUrl: tag(photo.user?.links?.html || 'https://unsplash.com'),
        sourceName: 'Unsplash',
        sourceUrl: tag('https://unsplash.com'),
        link: photo.links?.html,
        downloadLocation: photo.links?.download_location,
      }));

      return Response.json({ images }, {
        headers: { ...headers, 'Cache-Control': 'public, max-age=900' },
      });
    }

    /**
     * Unsplash requires a call to a photo's download endpoint when it is
     * actually used. Restricted to their own API host so this cannot be
     * turned into a general-purpose request relay.
     */
    if (url.pathname === '/images/used' && request.method === 'GET') {
      const target = url.searchParams.get('url') || '';
      if (!target.startsWith('https://api.unsplash.com/')) {
        return new Response('Rejected.', { status: 400, headers });
      }
      if (env.UNSPLASH_ACCESS_KEY) {
        await fetch(target, {
          headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` },
        }).catch(() => {});
      }
      return new Response(null, { status: 204, headers });
    }

    /* ---- palette generation ------------------------------------------ */
    if (url.pathname === '/palette' && request.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) {
        return Response.json(
          { error: 'No API key configured on the worker.' },
          { status: 500, headers }
        );
      }

      const { system, prompt } = await request.json();

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        return Response.json({ error: `Anthropic returned ${res.status}` }, { status: 502, headers });
      }

      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      return Response.json({ text }, { headers });
    }

    /* ---- page fetch --------------------------------------------------- */
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Pass ?url= to fetch a page, or POST to /palette.', { status: 400, headers });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('That is not a valid address.', { status: 400, headers });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response('Only http and https are allowed.', { status: 400, headers });
    }

    const page = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Palletio/1.0 (colour extraction)' },
      cf: { cacheTtl: 600 },
    });
    let body = await page.text();

    // Follow same-origin stylesheets so colours defined in CSS are included,
    // not just the ones written inline. Capped to keep the response small.
    const links = [...body.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)]
      .map((m) => m[1])
      .slice(0, 5);

    for (const href of links) {
      try {
        const sheetUrl = new URL(href, parsed).toString();
        const sheet = await fetch(sheetUrl);
        if (sheet.ok) body += '\n' + (await sheet.text()).slice(0, 200000);
      } catch {
        /* a stylesheet that will not load is not worth failing the request over */
      }
    }

    return new Response(body.slice(0, 900000), {
      headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
