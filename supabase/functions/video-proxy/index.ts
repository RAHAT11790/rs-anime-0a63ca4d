import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
};

const isAllowedClientOrigin = (value: string | null): boolean => {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith('.lovable.app');
  } catch {
    return false;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let videoUrl: string | null = null;

    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams;
      videoUrl = params.get('url');
    } else {
      const body = await req.json();
      videoUrl = body.url;
    }

    if (!videoUrl) {
      return new Response('URL required', { status: 400, headers: corsHeaders });
    }

    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const secFetchDest = (req.headers.get('sec-fetch-dest') || '').toLowerCase();
    const isMediaRequest = secFetchDest === '' || secFetchDest === 'video' || secFetchDest === 'audio' || secFetchDest === 'empty';
    const allowedSource = isAllowedClientOrigin(origin) || isAllowedClientOrigin(referer);

    if (!allowedSource || !isMediaRequest) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(videoUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid protocol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build headers for upstream request - optimized for speed
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Skip compression for faster streaming
      'Connection': 'keep-alive',
    };
    
    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

    // Fetch with streaming - longer timeout for large 4K files
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout for 4K
    
    const response = await fetch(parsedUrl.toString(), { 
      headers: fetchHeaders,
      // @ts-ignore - Deno supports this
      redirect: 'follow',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      return new Response(JSON.stringify({ error: `Upstream returned ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream headers
    const headers = new Headers(corsHeaders);
    const ct = response.headers.get('Content-Type');
    headers.set('Content-Type', ct || 'application/octet-stream');
    
    if (response.headers.get('Content-Length')) {
      headers.set('Content-Length', response.headers.get('Content-Length')!);
    }
    if (response.headers.get('Content-Range')) {
      headers.set('Content-Range', response.headers.get('Content-Range')!);
    }
    headers.set('Accept-Ranges', 'bytes');
    
    // Aggressive caching - cache for 24h to speed up repeated requests
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600');
    // Allow browser to use stale cache while revalidating
    headers.set('Vary', 'Range');

    // Stream the response body directly - no buffering
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
