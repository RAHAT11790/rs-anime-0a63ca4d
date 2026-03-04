import { supabase } from '@/integrations/supabase/client';

export const animeSaltApi = {
  async browse(page = 1, language?: string) {
    const { data, error } = await supabase.functions.invoke('scrape-animesalt', {
      body: { action: 'browse', page, language },
    });
    if (error) throw error;
    return data;
  },

  async getSeries(slug: string) {
    const { data, error } = await supabase.functions.invoke('scrape-animesalt', {
      body: { action: 'series', slug },
    });
    if (error) throw error;
    return data;
  },

  async getEpisode(slug: string) {
    const { data, error } = await supabase.functions.invoke('scrape-animesalt', {
      body: { action: 'episode', slug },
    });
    if (error) throw error;
    return data;
  },
};
