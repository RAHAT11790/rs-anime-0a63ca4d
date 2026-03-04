const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Known ad/tracking domains to block
const AD_DOMAINS = [
  'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
  'doubleclick.net', 'adsterra.com', 'popads.net', 'popcash.net',
  'propellerads.com', 'adnxs.com', 'adskeeper.co.uk', 'mgid.com',
  'exoclick.com', 'juicyads.com', 'trafficjunky.com', 'clickadu.com',
  'hilltopads.net', 'a-ads.com', 'ad-maven.com', 'admaven.com',
  'revcontent.com', 'outbrain.com', 'taboola.com', 'disqusads.com',
  'revenuehits.com', 'bidvertiser.com', 'yllix.com', 'adf.ly',
  'shorte.st', 'bc.vc', 'linkvertise.com', 'ouo.io',
  'marphezis.com', 'trkrspace.com', 'themonkeyspace.com',
  'adinplay.com', 'mantisadnetwork.com', 'ad.gt',
  'popunder.net', 'clickaine.com', 'acint.net',
  'tsyndicate.com', 'onclickmax.com', 'onclickmega.com',
  'onclickgenius.com', 'popmyads.com', 'richpush.co',
  'pushprofit.net', 'pushame.com', 'push.house',
  'notifpush.com', 'rolands-ede.com', 'kaizenplatform.net',
  'adguard.com', // Not actually an ad, but DNS resolver
];

// Patterns in script content that indicate ads
const AD_SCRIPT_PATTERNS = [
  /pop(?:up|under|ads|cash)/i,
  /window\.open\s*\(/i,
  /document\.createElement\s*\(\s*['\"](?:script|iframe)['"].*?(?:ad|track|pop)/i,
  /onclick\s*=.*?window\.open/i,
  /(?:var|let|const)\s+\w*(?:ad|banner|popup|overlay)\w*\s*=/i,
  /\.push\s*\(\s*\{.*?(?:ad|zone|banner)/i,
  /anti.?adblock/i,
  /adblock.?detect/i,
  /DisableDevtool/i,
];

function isAdDomain(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith('//') ? 'https:' + url : url).hostname;
    return AD_DOMAINS.some(ad => hostname.includes(ad));
  } catch {
    // Check raw string
    return AD_DOMAINS.some(ad => url.includes(ad));
  }
}

function isAdScript(content: string): boolean {
  return AD_SCRIPT_PATTERNS.some(p => p.test(content));
}

function cleanHTML(html: string, embedUrl: string): string {
  // 1. Remove script tags with ad domains in src
  html = html.replace(/<script[^>]*\ssrc\s*=\s*[\"']([\"']+)[^>]*>[\s\S]*?<\/script>/gi, (match, src) => {
    if (isAdDomain(src)) return '<!-- ad blocked -->';
    return match;
  });

  // 2. Remove inline scripts with ad patterns
  html = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, (match) => {
    // Keep scripts that load the actual video player
    if (match.includes('playerjs') || match.includes('Playerjs') || 
        match.includes('jwplayer') || match.includes('video.js') ||
        match.includes('plyr') || match.includes('hls.js') ||
        match.includes('dash.js') || match.includes('clappr') ||
        match.includes('flowplayer') || match.includes('MediaSource') ||
        match.includes('firePlayer') || match.includes('FirePlayer') ||
        match.includes('.m3u8') || match.includes('.mp4')) {
      // Still clean ad patterns from player scripts
      let cleaned = match;
      // Remove window.open calls
      cleaned = cleaned.replace(/window\.open\s*\([^)]*\)\s*;?/g, 'void(0);');
      return cleaned;
    }
    if (isAdScript(match)) return '<!-- ad script blocked -->';
    return match;
  });

  // 3. Remove iframes with ad domains
  html = html.replace(/<iframe[^>]*\s(?:src|data-src)\s*=\s*[\"']([\"']+)[^>]*>[\s\S]*?<\/iframe>/gi, (match, src) => {
    if (isAdDomain(src)) return '<!-- ad iframe blocked -->';
    return match;
  });

  // 4. Remove link/img tags with ad domains
  html = html.replace(/<(?:link|img)[^>]*(?:href|src)\s*=\s*[\"']([\"']+)[^>]*\/?\>/gi, (match, src) => {
    if (isAdDomain(src)) return '<!-- ad resource blocked -->';
    return match;
  });

  // 5. Remove common ad container divs
  html = html.replace(/<div[^>]*(?:id|class)\s*=\s*[\"'][^\"']*(?:ad-|ads-|banner|popup|overlay|interstitial|sticky-ad)[^\"']*[\"'][^>]*>[\s\S]*?<\/div>/gi, 
    '<!-- ad div blocked -->');

  // 6. Inject our ad-blocking script at the start of <head> or <body>
  const adBlockScript = `
<script>
// Block popups, redirects, and ad injections
(function() {
  'use strict';
  
  // Block window.open
  const _open = window.open;
  window.open = function() { return null; };
  
  // Block creating ad elements
  const _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = _createElement(tag);
    if (tag.toLowerCase() === 'script') {
      const origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'src' && value) {
          const blocked = ${JSON.stringify(AD_DOMAINS)};
          if (blocked.some(d => value.includes(d))) return;
        }
        return origSetAttr(name, value);
      };
      Object.defineProperty(el, 'src', {
        set: function(v) {
          const blocked = ${JSON.stringify(AD_DOMAINS)};
          if (v && blocked.some(d => v.includes(d))) return;
          origSetAttr('src', v);
        },
        get: function() { return el.getAttribute('src'); }
      });
    }
    return el;
  };
  
  // Block document.write (often used for ads)
  document.write = function() {};
  document.writeln = function() {};
  
  // DON'T add beforeunload - it causes "Leave site?" dialog on mobile
  // window.addEventListener('beforeunload', function(e) { e.preventDefault(); });
  
  // Prevent top-frame navigation
  if (window.top !== window.self) {
    try { window.top.location; } catch(e) {}
  }
  
  // Remove ad overlays periodically
  setInterval(function() {
    // Remove fixed/absolute positioned overlays
    document.querySelectorAll('div, aside, section').forEach(function(el) {
      var style = getComputedStyle(el);
      var isOverlay = (style.position === 'fixed' || style.position === 'absolute') && 
                      (parseInt(style.zIndex) > 1000 || style.zIndex === 'auto') &&
                      !el.querySelector('video, canvas, .jw-wrapper, .plyr, [class*=player]');
      if (isOverlay && el.offsetWidth > 100 && el.offsetHeight > 100) {
        // Check if it's likely an ad overlay (not the video player)
        var hasVideo = el.querySelector('video') || el.closest('[class*=player]');
        if (!hasVideo) {
          el.style.display = 'none';
        }
      }
    });
    // Hide common ad selectors
    var adSelectors = [
      '[id*=\\"ad-\\"]', '[id*=\\"ads-\\"]', '[class*=\\"ad-container\\"]', '[class*=\\"ad-wrapper\\"]',
      '[class*=\\"banner\\"]', '[class*=\\"popup\\"]', '.overlay-ad', '#overlay',
      'a[target=\\"_blank\\"][rel*=\\"nofollow\\"]'
    ];
    adSelectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        if (!el.closest('[class*=player]') && !el.querySelector('video')) {
          el.style.display = 'none';
        }
      });
    });
  }, 500);
  
  // Block fetch/XHR to ad domains
  var _fetch = window.fetch;
  window.fetch = function(url) {
    if (typeof url === 'string') {
      var blocked = ${JSON.stringify(AD_DOMAINS)};
      if (blocked.some(function(d) { return url.includes(d); })) {
        return Promise.reject(new Error('blocked'));
      }
    }
    return _fetch.apply(this, arguments);
  };
  
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') {
      var blocked = ${JSON.stringify(AD_DOMAINS)};
      if (blocked.some(function(d) { return url.includes(d); })) {
        this._blocked = true;
        return;
      }
    }
    return _xhrOpen.apply(this, arguments);
  };
  var _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return _xhrSend.apply(this, arguments);
  };
})();
</script>
<style>
  /* Hide common ad elements */
  [id*=\\"ad-\\"], [id*=\\"ads-\\"], [class*=\\"ad-container\\"], [class*=\\"ad-wrapper\\"],
  [class*=\\"banner-ad\\"], [class*=\\"popup\\"], .overlay-ad, #overlay,
  div[style*=\\"z-index: 9999\\"], div[style*=\\"z-index:9999\\"],
  a[target=\\"_blank\\"][rel*=\\"sponsored\\"] {
    display: none !important;
    pointer-events: none !important;
  }
  /* Ensure video takes full space */
  body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #000 !important; }
  video, .jw-wrapper, .plyr, [class*=player], iframe { 
    width: 100% !important; 
    height: 100% !important; 
    max-width: 100vw !important;
    max-height: 100vh !important;
  }
</style>`;

  // Inject after <head> or at start
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + adBlockScript);
  } else if (html.includes('<head ')) {
    html = html.replace(/<head\s[^>]*>/, '$&' + adBlockScript);
  } else if (html.includes('<body')) {
    html = html.replace(/<body[^>]*>/, '$&' + adBlockScript);
  } else {
    html = adBlockScript + html;
  }

  // 7. Add Content-Security-Policy meta tag to block ad domains
  const cspDomains = AD_DOMAINS.slice(0, 20).map(d => `*.${d}`).join(' ');
  const cspMeta = `<meta http-equiv=\"Content-Security-Policy\" content=\"default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: *; style-src * 'unsafe-inline'; img-src * data: blob:; media-src * blob: data:; connect-src * blob: data:; frame-src *;\">`;
  
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + cspMeta);
  } else if (html.includes('<head ')) {
    html = html.replace(/<head\s[^>]*>/, '$&' + cspMeta);
  }

  return html;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the embed page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': new URL(url).origin + '/',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let html = await response.text();
    
    // Clean the HTML
    html = cleanHTML(html, url);

    // Return clean HTML
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  } catch (error) {
    console.error('Clean embed error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
