import { supabase } from "@/integrations/supabase/client";

const TERABOX_DOMAINS = [
  'terabox.com', '1024terabox.com', 'teraboxapp.com',
  'teraboxshare.com', 'terabox.app',
  'terafileshare.com', 'freeterabox.com',
];

/**
 * Check if a URL is a TeraBox link
 */
export function isTeraboxLink(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return TERABOX_DOMAINS.some(d => parsed.hostname === d || parsed.hostname === `www.${d}`);
  } catch {
    // Check raw string
    return TERABOX_DOMAINS.some(d => url.includes(d));
  }
}

/**
 * Extract surl from TeraBox URL
 */
export function extractTeraboxSurl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) return pathMatch[1];
    const surlParam = parsed.searchParams.get('surl');
    if (surlParam) return surlParam;
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    if (lastSegment && lastSegment.length > 6) return lastSegment;
  } catch {}
  return null;
}

/**
 * Get TeraBox embed URL from a share link
 */
export function getTeraboxEmbedUrl(url: string): string | null {
  const surl = extractTeraboxSurl(url);
  if (!surl) return null;
  return `https://www.terabox.com/sharing/embed?surl=${surl}&resolution=1080&autoplay=true`;
}

export interface TeraboxResolveResult {
  success: boolean;
  surl: string;
  embedUrl: string;
  videos: {
    filename: string;
    size: number;
    fsId: string;
    dlink?: string;
    thumbnail?: string;
  }[];
  hasDirect: boolean;
  fallback?: boolean;
  error?: string;
}

/**
 * Resolve TeraBox link - tries to get direct video URL, falls back to embed
 */
export async function resolveTeraboxLink(url: string): Promise<TeraboxResolveResult> {
  const { data, error } = await supabase.functions.invoke('terabox-resolve', {
    body: { url },
  });

  if (error) {
    // Fallback to embed
    const surl = extractTeraboxSurl(url);
    if (surl) {
      return {
        success: true,
        surl,
        embedUrl: `https://www.terabox.com/sharing/embed?surl=${surl}&resolution=1080&autoplay=true`,
        videos: [],
        hasDirect: false,
        fallback: true,
        error: error.message,
      };
    }
    throw error;
  }

  return data as TeraboxResolveResult;
}

/**
 * Get the best playable URL from a TeraBox link
 * Returns { type: 'direct' | 'embed', url: string }
 */
export async function getTeraboxPlayableUrl(shareUrl: string): Promise<{ type: 'direct' | 'embed'; url: string; thumbnail?: string }> {
  try {
    const result = await resolveTeraboxLink(shareUrl);
    
    // If we got a direct link, proxy it through our video-proxy
    if (result.hasDirect && result.videos.length > 0) {
      const video = result.videos.find(v => v.dlink) || result.videos[0];
      if (video?.dlink) {
        const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-proxy`;
        return {
          type: 'direct',
          url: `${proxyBase}?url=${encodeURIComponent(video.dlink)}`,
          thumbnail: video.thumbnail,
        };
      }
    }

    // Fallback to embed
    return {
      type: 'embed',
      url: result.embedUrl,
    };
  } catch {
    // Ultimate fallback - just build embed URL
    const surl = extractTeraboxSurl(shareUrl);
    if (surl) {
      return {
        type: 'embed',
        url: `https://www.terabox.com/sharing/embed?surl=${surl}&resolution=1080&autoplay=true`,
      };
    }
    throw new Error('Invalid TeraBox URL');
  }
}
