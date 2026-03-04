const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let url: string | null = null;

    // Support both GET (query param) and POST (JSON body)
    if (req.method === 'GET') {
      url = new URL(req.url).searchParams.get('url');
    } else {
      const body = await req.json();
      url = body.url;
    }

    if (!url) {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let referer = 'https://animesalt.top/';
    let baseOrigin = '';
    try {
      const urlObj = new URL(url);
      referer = urlObj.origin + '/';
      baseOrigin = urlObj.origin;
    } catch {}

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use final URL after redirects as the base
    const finalUrl = response.url || url;
    let finalBase = baseOrigin;
    try {
      const fu = new URL(finalUrl);
      finalBase = fu.origin;
    } catch {}

    let html = await response.text();

    if (html.includes('<title>Error</title>') || html.includes('Video not found')) {
      const errorHtml = `<!DOCTYPE html><html><head><style>body{margin:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center}h2{font-size:18px;opacity:0.7}</style></head><body><div><h2>⚠️ Video unavailable</h2><p style="opacity:0.5;font-size:14px">Try switching server</p></div></body></html>`;
      return new Response(errorHtml, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'ALLOWALL' },
      });
    }

    // Inject <base> tag so relative resources resolve correctly
    if (finalBase && !html.includes('<base ')) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${finalBase}/" />`);
    }

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  } catch (error) {
    console.error('Clean embed error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
