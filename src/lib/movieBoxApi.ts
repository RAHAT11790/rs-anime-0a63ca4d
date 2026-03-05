import { supabase } from '@/integrations/supabase/client';

export const movieBoxApi = {
  async browse(page = 1) {
    const { data, error } = await supabase.functions.invoke('scrape-moviebox', {
      body: { action: 'browse', page },
    });
    if (error) throw error;
    return data;
  },

  async getDetail(slug: string) {
    const { data, error } = await supabase.functions.invoke('scrape-moviebox', {
      body: { action: 'detail', slug },
    });
    if (error) throw error;
    return data;
  },
};
