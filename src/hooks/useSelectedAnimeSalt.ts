import { useState, useEffect } from 'react';
import { db, ref, onValue } from '@/lib/firebase';
import type { AnimeItem } from '@/data/animeData';

export function useSelectedAnimeSalt() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onValue(ref(db, 'animesaltSelected'), (snap) => {
      const data = snap.val() || {};
      const converted: AnimeItem[] = Object.entries(data).map(([slug, item]: [string, any]) => ({
        id: `as_${slug}`,
        title: item.title || '',
        poster: item.poster || '',
        backdrop: item.backdrop || item.poster || '',
        year: item.year || '',
        rating: item.rating || '',
        language: item.language || '',
        category: item.category || 'Imported',
        type: item.type === 'movies' ? 'movie' as const : 'webseries' as const,
        storyline: item.storyline || '',
        source: 'animesalt' as const,
        slug: slug,
        createdAt: item.addedAt || 0,
      }));
      setItems(converted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { items, loading };
}
