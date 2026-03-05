import { useState, useEffect } from 'react';
import { movieBoxApi } from '@/lib/movieBoxApi';

export interface MovieBoxItem {
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  detailUrl: string;
}

const CACHE_KEY = 'moviebox_data_v1';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function useMovieBoxData(enabled: boolean) {
  const [items, setItems] = useState<MovieBoxItem[]>([]);
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
          setItems(result.items);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ items: result.items, _ts: Date.now() }));
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
