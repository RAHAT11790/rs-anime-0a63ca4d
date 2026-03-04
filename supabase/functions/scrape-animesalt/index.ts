const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.text();
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseBrowse(html: string) {
  const items: { title: string; slug: string; poster: string; year?: string; quality?: string }[] = [];
  const seen = new Set<string>();

  // Match article blocks
  const articleRegex = /<article[\s\S]*?<\/article>/gi;
  const articles = html.match(articleRegex) || [];

  for (const article of articles) {
    // Extract series/movies link
    const linkMatch = article.match(/href="https?:\/\/animesalt\.top\/(series|movies)\/([^/"]+)\/?"/);
    if (!linkMatch || seen.has(linkMatch[2])) continue;

    const slug = linkMatch[2];
    seen.add(slug);

    // Poster image
    let poster = '';
    const imgMatch = article.match(/data-src="([^"]+)"/) || article.match(/src="(https?:[^"]+\.(?:jpg|png|webp)[^"]*)"/);
    if (imgMatch) {
      poster = imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1];
    }

    // Title from alt
    const altMatch = article.match(/alt="(?:Image\s*)?([^"]+)"/);
    let title = altMatch ? altMatch[1].replace(/^Image\s+/i, '') : '';
    if (!title || title === slug) {
      title = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }

    // Year
    const yearMatch = article.match(/<span[^>]*class="[^"]*year[^"]*"[^>]*>(\d{4})<\/span>/);
    const qualityMatch = article.match(/<span[^>]*class="[^"]*Qlty[^"]*"[^>]*>([^<]+)<\/span>/);

    items.push({
      title,
      slug,
      poster,
      year: yearMatch?.[1],
      quality: qualityMatch?.[1]?.trim(),
    });
  }

  // Also extract from popular/trending lists (link-only sections)
  const linkRegex = /href="https?:\/\/animesalt\.top\/series\/([^/"]+)\/?"/g;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      // Try to find a nearby alt text
      const nearbyAlt = html.substring(Math.max(0, m.index - 500), m.index + 500);
      const altM = nearbyAlt.match(/alt="(?:Image\s*)?([^"]+)"/);
      const imgM = nearbyAlt.match(/data-src="([^"]*tmdb[^"]*)"/);
      let poster = '';
      if (imgM) poster = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1];

      items.push({
        title: altM ? altM[1].replace(/^Image\s+/i, '') : m[1].replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        slug: m[1],
        poster,
      });
    }
  }

  return items;
}

function parseSeries(html: string, slug: string) {
  // Title
  const titleMatch = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' ');

  // Poster (w342)
  let poster = '';
  const posterMatch = html.match(/(?:data-src|src)="([^"]*tmdb[^"]*w342[^"]*)"/);
  if (posterMatch) poster = posterMatch[1].startsWith('//') ? 'https:' + posterMatch[1] : posterMatch[1];

  // Also try w500
  if (!poster) {
    const p2 = html.match(/(?:data-src|src)="([^"]*tmdb[^"]*w500[^"]*)"/);
    if (p2) poster = p2[1].startsWith('//') ? 'https:' + p2[1] : p2[1];
  }

  // Backdrop (w1280)
  let backdrop = '';
  const bdMatch = html.match(/class="TPostBg[^"]*"[^>]*(?:data-src|src)="([^"]*)"/) ||
    html.match(/(?:data-src|src)="([^"]*tmdb[^"]*w1280[^"]*)"/);
  if (bdMatch) backdrop = bdMatch[1].startsWith('//') ? 'https:' + bdMatch[1] : bdMatch[1];

  // Year
  const yearMatch = html.match(/<span[^>]*>\s*(\d{4})\s*<\/span>/) || html.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : '';

  // Overview - look for text between overview heading and "Read More"
  let storyline = '';
  const overviewIdx = html.indexOf('Overview');
  if (overviewIdx > -1) {
    const afterOverview = html.substring(overviewIdx, overviewIdx + 3000);
    // Get text content, strip tags
    const textMatch = afterOverview.match(/<\/\w+>\s*([\s\S]*?)(?:Read More|<div|<section)/i);
    if (textMatch) {
      storyline = textMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  // Languages
  const languages: string[] = [];
  const langRegex = /category\/language\/([^/"]+)/g;
  let lm;
  const seenLangs = new Set<string>();
  while ((lm = langRegex.exec(html)) !== null) {
    if (!seenLangs.has(lm[1])) {
      seenLangs.add(lm[1]);
      languages.push(lm[1].charAt(0).toUpperCase() + lm[1].slice(1));
    }
  }

  // Episodes
  const epRegex = /href="https?:\/\/animesalt\.top\/episode\/([^/"]+)\/?"/g;
  let em;
  const seenEps = new Set<string>();
  const episodes: { number: number; slug: string; season: number }[] = [];

  while ((em = epRegex.exec(html)) !== null) {
    if (!seenEps.has(em[1])) {
      seenEps.add(em[1]);
      const sxeMatch = em[1].match(/(\d+)x(\d+)$/);
      const season = sxeMatch ? parseInt(sxeMatch[1]) : 1;
      const epNum = sxeMatch ? parseInt(sxeMatch[2]) : episodes.length + 1;
      episodes.push({ number: epNum, slug: em[1], season });
    }
  }

  // Group by season
  const seasonMap: Record<number, typeof episodes> = {};
  episodes.forEach(ep => {
    if (!seasonMap[ep.season]) seasonMap[ep.season] = [];
    seasonMap[ep.season].push(ep);
  });

  const seasons = Object.entries(seasonMap)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([num, eps]) => ({
      name: `Season ${num}`,
      episodes: eps.sort((a, b) => a.number - b.number),
    }));

  return { title, slug, poster, backdrop, year, storyline, languages, seasons };
}

function parseEpisode(html: string) {
  // Term ID from body class
  const termIdMatch = html.match(/term-(\d+)/);
  const termId = termIdMatch ? termIdMatch[1] : '';

  // Servers
  const servers: { name: string; info: string }[] = [];
  const serverRegex = /<div class="server-name">([^<]*)<\/div>\s*<div class="server-info">([^<]*)<\/div>/g;
  let sm;
  while ((sm = serverRegex.exec(html)) !== null) {
    servers.push({ name: sm[1].trim(), info: sm[2].trim() });
  }

  // Construct embed URLs
  const embedUrls = servers.length > 0
    ? servers.map((_, i) => `https://animesalt.top/?trembed=${i}&trid=${termId}&trtype=1`)
    : termId ? [`https://animesalt.top/?trembed=0&trid=${termId}&trtype=1`] : [];

  // Next/prev episode
  const nextMatch = html.match(/href="https?:\/\/animesalt\.top\/episode\/([^/"]+)\/?"[^>]*>\s*<svg[^>]*>[\s\S]*?<polygon points="5 4 15 12 5 20/);
  const nextSlug = nextMatch ? nextMatch[1] : null;

  return { termId, servers, embedUrls, nextSlug };
}

async function getEmbedUrl(trembedUrl: string): Promise<string> {
  try {
    const html = await fetchHTML(trembedUrl);
    
    // Look for iframe src (various patterns)
    const iframePatterns = [
      /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i,
      /<iframe[^>]*\sdata-src\s*=\s*["']([^"']+)["']/i,
    ];
    
    for (const pattern of iframePatterns) {
      const match = html.match(pattern);
      if (match) {
        let src = match[1];
        if (src.startsWith('//')) src = 'https:' + src;
        // Skip self-referential URLs
        if (!src.includes('animesalt.top/?trembed=')) return src;
      }
    }

    // Look for video source
    const videoMatch = html.match(/<source[^>]*src=["']([^"']+)["']/i);
    if (videoMatch) return videoMatch[1];

    // Look for file/source in JS - expanded patterns
    const jsPatterns = [
      /(?:file|src|source|url)\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*?)["']/i,
      /(?:data-url|data-src|data-video)\s*=\s*["']([^"']+)["']/i,
      /embed_url\s*[:=]\s*["']([^"']+)["']/i,
      /player_url\s*[:=]\s*["']([^"']+)["']/i,
      /["'](?:https?:\/\/[^"']*?(?:embed|player|video)[^"']*?)["']/i,
    ];

    for (const pattern of jsPatterns) {
      const match = html.match(pattern);
      if (match) {
        let src = match[1] || match[0].replace(/["']/g, '');
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('http') && !src.includes('animesalt.top')) return src;
      }
    }

    // Return the raw HTML snippet for debugging (first 500 chars of body)
    console.log('Trembed HTML snippet:', html.substring(0, 800));
    
    return '';
  } catch (err) {
    console.error('getEmbedUrl error:', err);
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, slug, page = 1, language } = body;

    if (action === 'browse') {
      let url = 'https://animesalt.top/';
      if (language) url = `https://animesalt.top/category/language/${language}/`;
      if (page > 1) url += `page/${page}/`;

      const html = await fetchHTML(url);
      const items = parseBrowse(html);
      return jsonRes({ success: true, items });
    }

    if (action === 'series') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      const html = await fetchHTML(`https://animesalt.top/series/${slug}/`);
      const data = parseSeries(html, slug);
      return jsonRes({ success: true, data });
    }

    if (action === 'episode') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      const html = await fetchHTML(`https://animesalt.top/episode/${slug}/`);
      const data = parseEpisode(html);

      // Try to get actual embed URL - try multiple servers for reliability
      let embedUrl = '';
      for (const url of data.embedUrls) {
        embedUrl = await getEmbedUrl(url);
        if (embedUrl) break;
      }

      // If no direct URL found, fall back to trembed URL itself (iframe will load it)
      if (!embedUrl && data.embedUrls.length > 0) {
        embedUrl = data.embedUrls[0];
      }

      return jsonRes({ success: true, ...data, embedUrl });
    }

    return jsonRes({ success: false, error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Scraper error:', error);
    return jsonRes({ success: false, error: (error as Error).message }, 500);
  }
});
