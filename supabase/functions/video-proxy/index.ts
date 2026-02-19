import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const fetchHeaders: Record<string, string> = {};
    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

    const response = await fetch(videoUrl, { headers: fetchHeaders });

    const headers = new Headers(corsHeaders);
    const ct = response.headers.get('Content-Type');
    headers.set('Content-Type', ct || 'application/octet-stream');
    if (response.headers.get('Content-Length')) headers.set('Content-Length', response.headers.get('Content-Length')!);
    if (response.headers.get('Content-Range')) headers.set('Content-Range', response.headers.get('Content-Range')!);
    headers.set('Accept-Ranges', 'bytes');

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
