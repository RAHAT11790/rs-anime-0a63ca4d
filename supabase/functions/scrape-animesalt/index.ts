const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ANIMESALT_DOMAIN = 'animesalt.ac';
const ANIMESALT_BASE = `https://${ANIMESALT_DOMAIN}`;

async function fetchHTML(url: string): Promise<string> {
  // Auto-migrate old domain references
  const migratedUrl = url.replace(/animesalt\.top/g, ANIMESALT_DOMAIN);
  const res = await fetch(migratedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `${ANIMESALT_BASE}/`,
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${migratedUrl}`);
  return res.text();
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseBrowse(html: string) {
  const items: { title: string; slug: string; poster: string; year?: string; quality?: string; type?: string }[] = [];
  const seen = new Set<string>();

  const articleRegex = /<article[\s\S]*?<\/article>/gi;
  const articles = html.match(articleRegex) || [];

  for (const article of articles) {
    const linkMatch = article.match(/href="https?:\/\/animesalt\.(?:top|ac)\/(series|movies)\/([^/"]+)\/?"/);
    if (!linkMatch || seen.has(linkMatch[2])) continue;

    const contentType = linkMatch[1]; // 'series' or 'movies'
    const slug = linkMatch[2];
    seen.add(slug);

    let poster = '';
    const imgMatch = article.match(/data-src="([^"]+)"/) || article.match(/src="(https?:[^"]+\.(?:jpg|png|webp)[^"]*)"/);
    if (imgMatch) {
      poster = imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1];
    }

    const altMatch = article.match(/alt="(?:Image\s*)?([^"]+)"/);
    let title = altMatch ? altMatch[1].replace(/^Image\s+/i, '') : '';
    if (!title || title === slug) {
      title = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }

    const yearMatch = article.match(/<span[^>]*class="[^"]*year[^"]*"[^>]*>(\d{4})<\/span>/);
    const qualityMatch = article.match(/<span[^>]*class="[^"]*Qlty[^"]*"[^>]*>([^<]+)<\/span>/);

    items.push({
      title,
      slug,
      poster,
      year: yearMatch?.[1],
      quality: qualityMatch?.[1]?.trim(),
      type: contentType, // 'series' or 'movies'
    });
  }

  // Fallback: also look for links outside articles
  const linkRegex = /href="https?:\/\/animesalt\.top\/(series|movies)\/([^/"]+)\/?"/g;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      const nearbyAlt = html.substring(Math.max(0, m.index - 500), m.index + 500);
      const altM = nearbyAlt.match(/alt="(?:Image\s*)?([^"]+)"/);
      const imgM = nearbyAlt.match(/data-src="([^"]*tmdb[^"]*)"/);
      let poster = '';
      if (imgM) poster = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1];

      items.push({
        title: altM ? altM[1].replace(/^Image\s+/i, '') : m[2].replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        slug: m[2],
        poster,
        type: m[1], // 'series' or 'movies'
      });
    }
  }

  return items;
}

function parseSeries(html: string, slug: string) {
  // Title from h1
  const titleMatch = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' ');

  // Poster - look for TMDB image with w342 or w500
  let poster = '';
  const posterPatterns = [
    /(?:data-src|src)="(https?:\/\/image\.tmdb\.org\/t\/p\/w342\/[^"]+)"/i,
    /(?:data-src|src)="(https?:\/\/image\.tmdb\.org\/t\/p\/w500\/[^"]+)"/i,
    /(?:data-src|src)="([^"]*tmdb[^"]*w342[^"]*)"/,
    /(?:data-src|src)="([^"]*tmdb[^"]*w500[^"]*)"/,
  ];
  for (const p of posterPatterns) {
    const match = html.match(p);
    if (match) {
      poster = match[1].startsWith('//') ? 'https:' + match[1] : match[1];
      break;
    }
  }

  // Backdrop - derive from poster by replacing w342/w500 with w1280, or look for og:image
  let backdrop = '';
  if (poster) {
    backdrop = poster.replace('/w342/', '/w1280/').replace('/w500/', '/w1280/');
  }
  // Also try og:image meta tag
  if (!backdrop || backdrop === poster) {
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (ogMatch) {
      backdrop = ogMatch[1];
    }
  }
  // Fallback: look for TPostBg
  if (!backdrop || backdrop.includes('data:image')) {
    const bdMatch = html.match(/class="TPostBg[^"]*"[^>]*style="[^"]*url\(([^)]+)\)/);
    if (bdMatch) backdrop = bdMatch[1].startsWith('//') ? 'https:' + bdMatch[1] : bdMatch[1];
  }
  if (!backdrop || backdrop.includes('data:image')) backdrop = poster;

  // Year - from meta published_time or specific year span (NOT quality spans)
  let year = '';
  const publishedMatch = html.match(/"datePublished"\s*:\s*"(\d{4})/);
  if (publishedMatch) year = publishedMatch[1];
  if (!year) {
    const metaYear = html.match(/article:published_time[^>]*content="(\d{4})/);
    if (metaYear) year = metaYear[1];
  }
  if (!year) {
    // Look for year in a span but exclude quality values like 1080
    const yearSpans = html.match(/<span[^>]*>\s*(\d{4})\s*<\/span>/g) || [];
    for (const span of yearSpans) {
      const yMatch = span.match(/(\d{4})/);
      if (yMatch) {
        const y = parseInt(yMatch[1]);
        if (y >= 1950 && y <= 2030) { year = yMatch[1]; break; }
      }
    }
  }

  // Storyline from meta description (og:description or meta description)
  let storyline = '';
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                        html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
  if (metaDescMatch) {
    storyline = metaDescMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  }
  
  // Also try to find actual overview text in the page body
  const overviewPatterns = [
    // Look for description/synopsis blocks
    /<div[^>]*class="[^"]*Description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*overview[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // Text after "Overview" heading
    /Overview<\/(?:h\d|span|div|p)>\s*<(?:p|div|span)[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i,
  ];
  for (const pattern of overviewPatterns) {
    const match = html.match(pattern);
    if (match) {
      const text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text.length > 20 && !text.startsWith('Overview')) {
        storyline = text;
        break;
      }
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

  // Genres/Categories from category links
  const genres: string[] = [];
  const genreRegex = /category\/genre\/([^/"]+)/g;
  let gm;
  const seenGenres = new Set<string>();
  while ((gm = genreRegex.exec(html)) !== null) {
    if (!seenGenres.has(gm[1])) {
      seenGenres.add(gm[1]);
      genres.push(gm[1].charAt(0).toUpperCase() + gm[1].slice(1));
    }
  }

  // Episodes - first try to parse season buttons which have episode range info
  // Format: <a class="season-btn" data-post="310" data-season="1">Season 1 • 1-24 (24)</a>
  const seasonBtnRegex = /class="[^"]*season-btn[^"]*"[^>]*data-season="(\d+)"[^>]*>([^<]*)</g;
  let sbm;
  const seasonBtnData: { season: number; text: string; startEp: number; endEp: number }[] = [];
  
  while ((sbm = seasonBtnRegex.exec(html)) !== null) {
    const seasonNum = parseInt(sbm[1]);
    const text = sbm[2].trim();
    // Parse "Season X • 1-24 (24)" or "Season X • 1-12 (12)"
    const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      seasonBtnData.push({
        season: seasonNum,
        text,
        startEp: parseInt(rangeMatch[1]),
        endEp: parseInt(rangeMatch[2]),
      });
    }
  }

  const episodes: { number: number; slug: string; season: number }[] = [];
  const seenEps = new Set<string>();

  if (seasonBtnData.length > 0) {
    // Generate all episodes from season button data
    for (const sData of seasonBtnData) {
      for (let epNum = sData.startEp; epNum <= sData.endEp; epNum++) {
        const epSlug = `${slug}-${sData.season}x${epNum}`;
        if (!seenEps.has(epSlug)) {
          seenEps.add(epSlug);
          episodes.push({ number: epNum, slug: epSlug, season: sData.season });
        }
      }
    }
  } else {
    // Fallback: parse episode links from HTML
    const epRegex = /href="https?:\/\/animesalt\.top\/episode\/([^/"]+)\/?"/g;
    let em;
    while ((em = epRegex.exec(html)) !== null) {
      if (!seenEps.has(em[1])) {
        seenEps.add(em[1]);
        const sxeMatch = em[1].match(/(\d+)x(\d+)$/);
        const season = sxeMatch ? parseInt(sxeMatch[1]) : 1;
        const epNum = sxeMatch ? parseInt(sxeMatch[2]) : episodes.length + 1;
        episodes.push({ number: epNum, slug: em[1], season });
      }
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

  return { title, slug, poster, backdrop, year, storyline, languages, genres, seasons };
}

function parseEpisode(html: string) {
  const termIdMatch = html.match(/term-(\d+)/);
  const termId = termIdMatch ? termIdMatch[1] : '';

  const servers: { name: string; info: string }[] = [];
  const serverRegex = /<div class="server-name">([^<]*)<\/div>\s*<div class="server-info">([^<]*)<\/div>/g;
  let sm;
  while ((sm = serverRegex.exec(html)) !== null) {
    servers.push({ name: sm[1].trim(), info: sm[2].trim() });
  }

  // Extract embed URLs from .video.aa-tb divs
  const embedUrls: string[] = [];
  const videoBlockRegex = /<div[^>]*class="[^"]*video aa-tb[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  const videoBlocks = html.match(videoBlockRegex) || [];
  
  for (const block of videoBlocks) {
    const srcMatch = block.match(/(?:data-src|src)\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (srcMatch) {
      embedUrls.push(srcMatch[1]);
    }
  }

  // Also try iframes
  if (embedUrls.length === 0) {
    const iframeRegex = /(?:data-src|src)\s*=\s*["'](https?:\/\/(?:as-cdn21\.top|beta\.awstream\.net|[^"']*embed[^"']*)[^"']+)["']/gi;
    let im;
    while ((im = iframeRegex.exec(html)) !== null) {
      if (!embedUrls.includes(im[1])) {
        embedUrls.push(im[1]);
      }
    }
  }

  // Fallback: construct trembed URLs
  if (embedUrls.length === 0 && termId) {
    for (let i = 0; i < Math.max(servers.length, 1); i++) {
      embedUrls.push(`https://animesalt.top/?trembed=${i}&trid=${termId}&trtype=1`);
    }
  }

  // Next/prev episode
  const nextMatch = html.match(/href="https?:\/\/animesalt\.top\/episode\/([^/"]+)\/?"[^>]*>\s*<svg[^>]*>[\s\S]*?<polygon points="5 4 15 12 5 20/);
  const nextSlug = nextMatch ? nextMatch[1] : null;

  return { termId, servers, embedUrls, nextSlug };
}

async function getEmbedUrl(trembedUrl: string): Promise<string> {
  try {
    const html = await fetchHTML(trembedUrl);
    
    const iframePatterns = [
      /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i,
      /<iframe[^>]*\sdata-src\s*=\s*["']([^"']+)["']/i,
    ];
    
    for (const pattern of iframePatterns) {
      const match = html.match(pattern);
      if (match) {
        let src = match[1];
        if (src.startsWith('//')) src = 'https:' + src;
        if (!src.includes('animesalt.top/?trembed=') && !src.includes('animesalt.top/wp-')) return src;
      }
    }

    const videoMatch = html.match(/<source[^>]*src=["']([^"']+)["']/i);
    if (videoMatch) return videoMatch[1];

    const jsPatterns = [
      /(?:file|src|source|url)\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*?)["']/i,
      /(?:data-url|data-src|data-video)\s*=\s*["']([^"']+)["']/i,
    ];

    for (const pattern of jsPatterns) {
      const match = html.match(pattern);
      if (match) {
        let src = match[1];
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('http') && !src.includes('animesalt.top')) return src;
      }
    }

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
    const { action, slug, page = 1, language, contentType } = body;

    if (action === 'browse') {
      let url = 'https://animesalt.top/';
      if (contentType === 'movies') url = 'https://animesalt.top/movies/';
      else if (contentType === 'series') url = 'https://animesalt.top/series/';
      else if (language) url = `https://animesalt.top/category/language/${language}/`;
      if (page > 1) url += `page/${page}/`;

      const html = await fetchHTML(url);
      const items = parseBrowse(html);
      
      // Extract max page from pagination
      let maxPage = 1;
      const pageLinks = html.match(/\/page\/(\d+)\//g) || [];
      for (const pl of pageLinks) {
        const pMatch = pl.match(/\/page\/(\d+)\//);
        if (pMatch) maxPage = Math.max(maxPage, parseInt(pMatch[1]));
      }
      
      return jsonRes({ success: true, items, maxPage, currentPage: page });
    }

    if (action === 'browse_all') {
      // Fetch all pages of series and movies
      const allItems: any[] = [];
      const seen = new Set<string>();
      
      const fetchAllPages = async (baseUrl: string) => {
        let currentPage = 1;
        let hasMore = true;
        
        while (hasMore && currentPage <= 20) { // Safety limit
          const url = currentPage > 1 ? `${baseUrl}page/${currentPage}/` : baseUrl;
          try {
            const html = await fetchHTML(url);
            const items = parseBrowse(html);
            
            if (items.length === 0) {
              hasMore = false;
              break;
            }
            
            let newCount = 0;
            for (const item of items) {
              if (!seen.has(item.slug)) {
                seen.add(item.slug);
                allItems.push(item);
                newCount++;
              }
            }
            
            // Check if there's a next page
            const hasNext = html.includes(`/page/${currentPage + 1}/`);
            if (!hasNext || newCount === 0) {
              hasMore = false;
            }
            
            currentPage++;
          } catch {
            hasMore = false;
          }
        }
      };
      
      // Fetch series and movies pages in parallel
      await Promise.all([
        fetchAllPages('https://animesalt.top/series/'),
        fetchAllPages('https://animesalt.top/movies/'),
      ]);
      
      return jsonRes({ success: true, items: allItems, totalCount: allItems.length });
    }

    if (action === 'series') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      const html = await fetchHTML(`https://animesalt.top/series/${slug}/`);
      const data = parseSeries(html, slug);
      return jsonRes({ success: true, data });
    }

    if (action === 'movie') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      const html = await fetchHTML(`https://animesalt.top/movies/${slug}/`);
      const data = parseSeries(html, slug); // Same parser works for movies
      
      // For movies, get the embed URL directly
      const epData = parseEpisode(html);
      let movieEmbedUrl = epData.embedUrls[0] || '';
      if (movieEmbedUrl.includes('trembed')) {
        for (const url of epData.embedUrls) {
          const resolved = await getEmbedUrl(url);
          if (resolved) { movieEmbedUrl = resolved; break; }
        }
      }
      
      return jsonRes({ success: true, data: { ...data, movieEmbedUrl, allEmbeds: epData.embedUrls } });
    }

    if (action === 'episode') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      
      // Try multiple URL patterns
      let html = '';
      const urls = [
        `https://animesalt.top/episode/${slug}/`,
        `https://animesalt.top/episodes/${slug}/`,
        `https://animesalt.top/${slug}/`,
      ];
      
      for (const url of urls) {
        try {
          html = await fetchHTML(url);
          break;
        } catch {
          continue;
        }
      }
      
      if (!html) {
        return jsonRes({ success: false, error: `Episode not found: ${slug}` }, 404);
      }
      
      const data = parseEpisode(html);

      let embedUrl = data.embedUrls[0] || '';
      
      if (embedUrl.includes('trembed')) {
        for (const url of data.embedUrls) {
          const resolved = await getEmbedUrl(url);
          if (resolved) {
            embedUrl = resolved;
            break;
          }
        }
      }

      return jsonRes({ success: true, ...data, embedUrl, allEmbeds: data.embedUrls });
    }

    if (action === 'test_embed') {
      const { url } = body;
      if (!url) return jsonRes({ success: false, error: 'url required' }, 400);
      const html = await fetchHTML(url);
      return jsonRes({ success: true, html: html.substring(0, 5000), htmlLen: html.length });
    }

    if (action === 'debug_episode') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);
      const html = await fetchHTML(`https://animesalt.top/series/${slug}/`);
      // Extract season section HTML (around each "Season X" occurrence)
      const seasonChunks: string[] = [];
      const seasonRegex = /Season\s*(\d+)/gi;
      let sm;
      while ((sm = seasonRegex.exec(html)) !== null) {
        const start = Math.max(0, sm.index - 500);
        const end = Math.min(html.length, sm.index + 2000);
        seasonChunks.push(html.substring(start, end));
      }
      return jsonRes({ success: true, seasonChunks });
    }

    return jsonRes({ success: false, error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Scraper error:', error);
    return jsonRes({ success: false, error: (error as Error).message }, 500);
  }
});
