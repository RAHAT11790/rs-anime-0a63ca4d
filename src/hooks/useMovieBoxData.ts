import { useState, useEffect } from 'react';
import { movieBoxApi } from '@/lib/movieBoxApi';
import type { AnimeItem } from '@/data/animeData';

const CACHE_KEY = 'moviebox_data_v2';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function useMovieBoxData(enabled: boolean) {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // Try cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.items?.length > 0 && Date.now() - (parsed._ts || 0) < CACHE_DURATION) {
          setItems(parsed.items);
          setLoading(false);
          return;
        }
      }
    } catch {}

    const load = async () => {
      setLoading(true);
      try {
        const result = await movieBoxApi.browse();
        if (result.success && result.items?.length > 0) {
          const converted: AnimeItem[] = result.items.map((item: any) => ({
            id: `mb_${item.slug}`,
            title: item.title,
            poster: item.poster,
            backdrop: item.poster,
            year: item.year || '',
            rating: item.rating || '',
            language: typeof item.subtitles === 'string' ? item.subtitles.replace(/,/g, ', ') : '',
            category: 'MovieBox',
            type: (item.subjectType === 2 ? 'webseries' : 'movie') as 'webseries' | 'movie',
            storyline: item.description || '',
            source: 'moviebox' as const,
            slug: item.slug,
          }));
          setItems(converted);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ items: converted, _ts: Date.now() }));
          } catch {}
        }
      } catch (err) {
        console.error('MovieBox load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [enabled]);

  return { items, loading };
}
