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
