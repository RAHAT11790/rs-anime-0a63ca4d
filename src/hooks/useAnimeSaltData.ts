import { useState, useEffect } from 'react';
import { animeSaltApi } from '@/lib/animeSaltApi';
import type { AnimeItem } from '@/data/animeData';

export function useAnimeSaltData() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try cache first
    try {
      const cached = sessionStorage.getItem('animesalt_browse_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.items?.length > 0 && Date.now() - (parsed._ts || 0) < 30 * 60 * 1000) {
          setItems(parsed.items);
          setLoading(false);
          return; // Use cache, don't refetch
        }
      }
    } catch {}

    const load = async () => {
      try {
        // Fetch both homepage (mixed) and movies page in parallel
        const [browseResult, moviesResult] = await Promise.all([
          animeSaltApi.browse(),
          animeSaltApi.browse(1, undefined, 'movies'),
        ]);

        const allRaw: any[] = [];
        const seen = new Set<string>();

        const addItems = (result: any) => {
          if (result.success && result.items) {
            for (const item of result.items) {
              if (item.poster && !seen.has(item.slug)) {
                seen.add(item.slug);
                allRaw.push(item);
              }
            }
          }
        };

        addItems(browseResult);
        addItems(moviesResult);

        const converted: AnimeItem[] = allRaw.map((item: any) => ({
          id: `as_${item.slug}`,
          title: item.title,
          poster: item.poster || '',
          backdrop: item.poster?.replace('/w342/', '/w1280/').replace('/w500/', '/w1280/') || '',
          year: item.year || '',
          rating: '',
          language: '',
          category: 'AnimeSalt',
          type: item.type === 'movies' ? 'movie' as const : 'webseries' as const,
          storyline: '',
          source: 'animesalt' as const,
          slug: item.slug,
        }));

        setItems(converted);
        sessionStorage.setItem('animesalt_browse_v2', JSON.stringify({ items: converted, _ts: Date.now() }));
      } catch (err) {
        console.error('AnimeSalt load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { items, loading };
}
