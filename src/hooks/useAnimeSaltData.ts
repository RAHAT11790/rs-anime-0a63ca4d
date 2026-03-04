import { useState, useEffect } from 'react';
import { animeSaltApi } from '@/lib/animeSaltApi';
import type { AnimeItem } from '@/data/animeData';

export function useAnimeSaltData() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try cache first
    try {
      const cached = sessionStorage.getItem('animesalt_browse');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0 && Date.now() - (parsed._ts || 0) < 30 * 60 * 1000) {
          setItems(parsed.items || parsed);
          setLoading(false);
        }
      }
    } catch {}

    const load = async () => {
      try {
        const result = await animeSaltApi.browse();
        if (result.success && result.items) {
          const converted: AnimeItem[] = result.items
            .filter((item: any) => item.poster) // Only items with posters
            .map((item: any) => ({
              id: `as_${item.slug}`,
              title: item.title,
              poster: item.poster || '',
              backdrop: item.poster?.replace('/w342/', '/w1280/').replace('/w500/', '/w1280/') || '',
              year: item.year || '',
              rating: '',
              language: '',
              category: 'AnimeSalt',
              type: 'webseries' as const,
              storyline: '',
              source: 'animesalt' as const,
              slug: item.slug,
            }));
          setItems(converted);
          // Cache with timestamp
          sessionStorage.setItem('animesalt_browse', JSON.stringify({ items: converted, _ts: Date.now() }));
        }
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
