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

// Resolve a single reference in Nuxt devalue payload
function resolveRef(arr: any[], ref: any): any {
  if (typeof ref !== 'number') return ref;
  if (ref < 0 || ref >= arr.length) return null;
  return arr[ref];
}

// Resolve an object at a given index, resolving its property references one level deep
function resolveObj(arr: any[], idx: number): any {
  const val = arr[idx];
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val;

  const result: any = {};
  for (const [key, ref] of Object.entries(val)) {
    const resolved = resolveRef(arr, ref);
    if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
      // Resolve nested object one more level (e.g., cover.url)
      const nested: any = {};
      for (const [k2, v2] of Object.entries(resolved)) {
        nested[k2] = resolveRef(arr, v2);
      }
      result[key] = nested;
    } else {
      result[key] = resolved;
    }
  }
  return result;
}

// Parse Nuxt 3 _payload.json to extract items
function parseNuxtPayload(payload: any[]): any[] {
  const items: any[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < payload.length; i++) {
    const val = payload[i];
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;

    // Check if this looks like a show/movie item template
    if ('title' in val && 'cover' in val && 'detailPath' in val && 'subjectId' in val) {
      try {
        const resolved = resolveObj(payload, i);
        if (!resolved.title || !resolved.cover?.url || !resolved.detailPath) continue;
        if (seen.has(resolved.detailPath)) continue;
        seen.add(resolved.detailPath);

        const year = resolved.releaseDate ? resolved.releaseDate.substring(0, 4) : '';

        items.push({
          title: resolved.title,
          slug: resolved.detailPath,
          poster: resolved.cover.url,
          year,
          rating: resolved.imdbRatingValue || '',
          genre: resolved.genre || '',
          subjectType: resolved.subjectType, // 1=movie, 2=series
          subtitles: resolved.subtitles || '',
          countryName: resolved.countryName || '',
          description: resolved.description || '',
          duration: resolved.duration || 0,
          detailUrl: `https://moviebox.ph/detail/${resolved.detailPath}`,
        });
      } catch {
        continue;
      }
    }
  }

  return items;
}

// Parse detail page payload for episodes/seasons
function parseDetailPayload(payload: any[]): any {
  let title = '';
  let poster = '';
  let backdrop = '';
  let description = '';
  let year = '';
  let rating = '';
  let subtitles = '';
  let genre = '';
  const seasons: { name: string; episodes: { number: number; title: string }[] }[] = [];

  for (let i = 0; i < payload.length; i++) {
    const val = payload[i];
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;

    // Main detail object
    if ('title' in val && 'cover' in val && 'detailPath' in val) {
      const resolved = resolveObj(payload, i);
      if (resolved.title) title = resolved.title;
      if (resolved.cover?.url) poster = resolved.cover.url;
      if (resolved.description) description = resolved.description;
      if (resolved.releaseDate) year = resolved.releaseDate.substring(0, 4);
      if (resolved.imdbRatingValue) rating = resolved.imdbRatingValue;
      if (resolved.subtitles) subtitles = resolved.subtitles;
      if (resolved.genre) genre = resolved.genre;
    }

    // Episode list - look for objects with episodeNumber/episodeName
    if ('episodeNumber' in val && ('episodeName' in val || 'title' in val)) {
      const resolved = resolveObj(payload, i);
      // Will be collected separately
    }

    // Season data
    if ('seasonNumber' in val && 'episodeList' in val) {
      try {
        const resolved = resolveObj(payload, i);
        const seasonNum = resolved.seasonNumber;
        const epList = resolved.episodeList;
        if (Array.isArray(epList)) {
          const episodes = epList.map((epIdx: number) => {
            if (typeof epIdx === 'number' && epIdx >= 0 && epIdx < payload.length) {
              const ep = resolveObj(payload, epIdx);
              return {
                number: ep.episodeNumber || ep.number || 0,
                title: ep.episodeName || ep.title || `Episode ${ep.episodeNumber || 0}`,
              };
            }
            return null;
          }).filter(Boolean);
          if (episodes.length > 0) {
            seasons.push({ name: `Season ${seasonNum}`, episodes });
          }
        }
      } catch {}
    }
  }

  // Try to get backdrop from stills or use poster
  backdrop = poster;

  return { title, poster, backdrop, description, year, rating, subtitles, genre, seasons };
}

async function fetchPayload(url: string): Promise<any[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://moviebox.ph/',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${url}`);
  const data = await res.json();
  // The payload might be wrapped in an array or be the array directly
  if (Array.isArray(data)) return data;
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, slug, page = 1 } = body;

    if (action === 'browse') {
      // Use Nuxt _payload.json endpoint for structured data
      let url = 'https://moviebox.ph/web/animated-series/_payload.json';
      if (page > 1) url = `https://moviebox.ph/web/animated-series/_payload.json?page=${page}`;

      const payload = await fetchPayload(url);
      const items = parseNuxtPayload(payload);

      return jsonRes({ success: true, items, totalCount: items.length });
    }

    if (action === 'detail') {
      if (!slug) return jsonRes({ success: false, error: 'slug required' }, 400);

      try {
        const url = `https://moviebox.ph/detail/${slug}/_payload.json`;
        const payload = await fetchPayload(url);
        const data = parseDetailPayload(payload);
        return jsonRes({ success: true, data });
      } catch (err) {
        console.error('Detail fetch error:', err);
        return jsonRes({ success: true, data: null });
      }
    }

    return jsonRes({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('MovieBox scrape error:', error);
    return jsonRes({ success: false, error: error.message }, 500);
  }
});
