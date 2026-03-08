import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const TERABOX_DOMAINS = [
  'terabox.com', '1024terabox.com', 'teraboxapp.com', 
  'teraboxshare.com', 'terabox.app', 'www.terabox.com',
  'www.1024terabox.com', 'www.teraboxapp.com',
  'terafileshare.com', 'www.terafileshare.com',
  'freeterabox.com', 'www.freeterabox.com',
];

function extractSurl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Format: /s/HASH or /sharing/link?surl=HASH
    const pathMatch = parsed.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) return pathMatch[1];
    const surlParam = parsed.searchParams.get('surl');
    if (surlParam) return surlParam;
    // Sometimes the hash is directly at end of path
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    if (lastSegment && lastSegment.length > 6) return lastSegment;
  } catch {}
  return null;
}

async function resolveTerabox(shareUrl: string) {
  const surl = extractSurl(shareUrl);
  if (!surl) throw new Error("Could not extract share ID from URL");

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.terabox.com/',
  };

  // Step 1: Fetch the share page to get cookies and jsToken
  const pageUrl = `https://www.terabox.com/s/${surl}`;
  const pageResp = await fetch(pageUrl, { headers, redirect: 'follow' });
  const pageHtml = await pageResp.text();

  // Extract jsToken
  const jsTokenMatch = pageHtml.match(/window\.jsToken\s*(?:=|%3D)\s*(?:%22|")?([a-fA-F0-9]+)(?:%22|")?/) 
    || pageHtml.match(/jsToken['"]\s*:\s*['"]([a-fA-F0-9]+)['"]/)
    || pageHtml.match(/jsToken\s*=\s*"([a-fA-F0-9]+)"/);
  
  // Extract cookies
  const cookies = pageResp.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

  // Try to extract shareid, uk, sign, timestamp from page
  const shareIdMatch = pageHtml.match(/shareid['"]\s*:\s*(\d+)/) || pageHtml.match(/"shareid"\s*:\s*(\d+)/);
  const ukMatch = pageHtml.match(/uk['"]\s*:\s*(\d+)/) || pageHtml.match(/"uk"\s*:\s*(\d+)/);
  const signMatch = pageHtml.match(/sign['"]\s*:\s*['"]([^'"]+)['"]/) || pageHtml.match(/"sign"\s*:\s*"([^"]+)"/);
  const timestampMatch = pageHtml.match(/timestamp['"]\s*:\s*(\d+)/) || pageHtml.match(/"timestamp"\s*:\s*(\d+)/);

  const jsToken = jsTokenMatch?.[1] || '';
  const shareid = shareIdMatch?.[1] || '';
  const uk = ukMatch?.[1] || '';
  const sign = signMatch?.[1] || '';
  const timestamp = timestampMatch?.[1] || '';

  // Step 2: Call the shorturlinfo API
  const apiUrl = `https://www.terabox.com/api/shorturlinfo?app_id=250528&shorturl=${surl}&root=1`;
  const apiHeaders = {
    ...headers,
    'Cookie': cookieStr,
    'Accept': 'application/json, text/plain, */*',
  };

  const apiResp = await fetch(apiUrl, { headers: apiHeaders });
  const apiData = await apiResp.json();

  if (apiData.errno !== 0) {
    // Try alternate API
    const altUrl = `https://www.terabox.com/share/list?app_id=250528&shorturl=${surl}&root=1&jsToken=${jsToken}&channel=dubox&web=1&clienttype=0`;
    const altResp = await fetch(altUrl, { headers: apiHeaders });
    const altData = await altResp.json();
    
    if (altData.errno === 0 && altData.list?.length > 0) {
      return processFileList(altData.list, surl, cookieStr, jsToken, shareid, uk, sign, timestamp);
    }
    throw new Error(`TeraBox API error: ${apiData.errno}`);
  }

  const fileList = apiData.list || apiData.file_list?.list || [];
  if (fileList.length === 0) throw new Error("No files found");

  return processFileList(fileList, surl, cookieStr, jsToken, shareid, uk, sign, timestamp);
}

async function processFileList(
  fileList: any[], surl: string, cookies: string, 
  jsToken: string, shareid: string, uk: string, sign: string, timestamp: string
) {
  const videos: any[] = [];

  for (const file of fileList) {
    const isVideo = file.isdir === 0 && (
      /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|ts)$/i.test(file.server_filename || file.filename || '') ||
      (file.category && file.category === 1)
    );

    if (isVideo || fileList.length === 1) {
      const item: any = {
        filename: file.server_filename || file.filename || 'video',
        size: file.size || 0,
        fsId: file.fs_id,
      };

      // Try to get dlink
      if (file.dlink) {
        item.dlink = file.dlink;
      } else if (shareid && uk && sign && timestamp && file.fs_id) {
        // Try to fetch dlink via download API
        try {
          const dlUrl = `https://www.terabox.com/share/download?app_id=250528&shorturl=${surl}&shareid=${shareid}&uk=${uk}&sign=${sign}&timestamp=${timestamp}&fid_list=[${file.fs_id}]&jsToken=${jsToken}&channel=dubox&web=1&clienttype=0`;
          const dlResp = await fetch(dlUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Cookie': cookies,
              'Accept': 'application/json',
              'Referer': `https://www.terabox.com/s/${surl}`,
            }
          });
          const dlData = await dlResp.json();
          if (dlData.errno === 0 && dlData.dlink) {
            item.dlink = dlData.dlink;
          } else if (dlData.list?.[0]?.dlink) {
            item.dlink = dlData.list[0].dlink;
          }
        } catch {}
      }

      // Thumbnail
      if (file.thumbs) {
        item.thumbnail = file.thumbs.url3 || file.thumbs.url2 || file.thumbs.url1 || '';
      }

      videos.push(item);
    }
  }

  // Build embed URL as fallback
  const embedUrl = `https://www.terabox.com/sharing/embed?surl=${surl}&resolution=1080&autoplay=true`;

  return {
    success: true,
    surl,
    embedUrl,
    videos,
    hasDirect: videos.some(v => v.dlink),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let url: string | null = null;

    if (req.method === 'GET') {
      url = new URL(req.url).searchParams.get('url');
    } else {
      const body = await req.json();
      url = body.url;
    }

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await resolveTerabox(url);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    // Return embed fallback even on error
    try {
      const url = req.method === 'GET' 
        ? new URL(req.url).searchParams.get('url') 
        : (await req.json().catch(() => ({}))).url;
      const surl = url ? extractSurl(url) : null;
      if (surl) {
        return new Response(JSON.stringify({
          success: true,
          surl,
          embedUrl: `https://www.terabox.com/sharing/embed?surl=${surl}&resolution=1080&autoplay=true`,
          videos: [],
          hasDirect: false,
          fallback: true,
          error: error.message,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch {}

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
