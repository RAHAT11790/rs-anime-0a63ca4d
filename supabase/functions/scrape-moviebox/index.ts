const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://moviebox.ph/',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${url}`);
  return res.text();
}

function parseAnimatedSeries(html: string) {
  const items: { title: string; slug: string; poster: string; year?: string; rating?: string; detailUrl: string }[] = [];
  const seen = new Set<string>();

  // Match links to detail pages with poster images
  // Pattern: <a href="/detail/{slug}"> containing img, title, year, rating
  const cardRegex = /href="(?:https?:\/\/moviebox\.ph)?\/detail\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[\s\S]*?<\/a>/gi;
  
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    
    const poster = match[2];
    let title = match[3].replace(/-full$/, '').trim();
    
    if (!title || !poster) continue;
    
    // Extract year and rating from nearby text
    const context = match[0];
    const yearMatch = context.match(/(\d{4})/);
    const ratingMatch = context.match(/(\d+\.\d)/);
    
    items.push({
      title,
      slug,
      poster: poster.includes('x-oss-process') ? poster.replace(/w_\d+/, 'w_500') : poster,
      year: yearMatch?.[1],
      rating: ratingMatch?.[1],
      detailUrl: `https://moviebox.ph/detail/${slug}`,
    });
  }

  // Fallback: try a simpler pattern matching detail links and nearby images
  if (items.length === 0) {
    const linkRegex = /href="(?:https?:\/\/moviebox\.ph)?\/detail\/([^"]+)"/g;
    let lm;
    while ((lm = linkRegex.exec(html)) !== null) {
      const slug = lm[1];
      if (seen.has(slug)) continue;
      seen.add(slug);

      // Look for poster image nearby (within 2000 chars before)
      const before = html.substring(Math.max(0, lm.index - 2000), lm.index + 1000);
      const imgMatch = before.match(/src="(https?:\/\/pbcdnw\.aoneroom\.com\/[^"]+)"/);
      const altMatch = before.match(/alt="([^"]*)-full"/);
      
      if (imgMatch) {
        const title = altMatch ? altMatch[1].trim() : slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const yearMatch = before.match(/(\d{4})/);
        const ratingMatch = before.match(/(\d+\.\d)/);
        
        items.push({
          title,
          slug,
          poster: imgMatch[1].includes('x-oss-process') ? imgMatch[1].replace(/w_\d+/, 'w_500') : imgMatch[1],
          year: yearMatch?.[1],
          rating: ratingMatch?.[1],
          detailUrl: `https://moviebox.ph/detail/${slug}`,
        });
      }
    }
  }

  return items;
}

// Try to get detail/play info from MovieBox API
async function getDetailFromAPI(slug: string) {
  try {
    // MovieBox has an internal API
    const res = await fetch(`https://moviebox.ph/detail/${slug}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://moviebox.ph/',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/<title>([^<|]+)/);
    const title = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' ');

    // Extract poster
    const posterMatch = html.match(/og:image[^>]*content="([^"]+)"/) || html.match(/poster[^>]*src="([^"]+)"/i);
    const poster = posterMatch ? posterMatch[1] : '';

    // Extract description
    const descMatch = html.match(/og:description[^>]*content="([^"]+)"/) || html.match(/description[^>]*content="([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

    // Extract year
    const yearMatch = html.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : '';

    return { title, poster, description, year, slug };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, slug, page = 1 } = body;

    if (action === 'browse') {
      // Fetch the animated-series page
      let url = 'https://moviebox.ph/web/animated-series';
      if (page > 1) url += `?page=${page}`;
      
      const html = await fetchHTML(url);
      const items = parseAnimatedSeries(html);
      
      return jsonRes({ success: true, items, totalCount: items.length });
    }

    if (action === 'detail') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      const data = await getDetailFromAPI(slug);
      return jsonRes({ success: true, data });
    }

    return jsonRes({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('MovieBox scrape error:', error);
    return jsonRes({ success: false, error: error.message }, 500);
  }
});
