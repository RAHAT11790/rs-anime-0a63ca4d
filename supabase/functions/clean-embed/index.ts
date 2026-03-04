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
];

function isAdDomain(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith('//') ? 'https:' + url : url).hostname;
    return AD_DOMAINS.some(ad => hostname.includes(ad));
  } catch {
    return AD_DOMAINS.some(ad => url.includes(ad));
  }
}

function cleanHTML(html: string, embedUrl: string): string {
  // 1. Remove script tags with ad domains in src
  html = html.replace(/<script[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi, (match, src) => {
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
        match.includes('.m3u8') || match.includes('.mp4') ||
        match.includes('player_base_url') || match.includes('defaultAudio') ||
        match.includes('jquery') || match.includes('jQuery') ||
        match.includes('scripts.php') || match.includes('remodal') ||
        match.includes('countup') || match.includes('player_loaded')) {
      // Clean ad-related code from player scripts
      let cleaned = match;
      cleaned = cleaned.replace(/window\.open\s*\([^)]*\)\s*;?/g, 'void(0);');
      return cleaned;
    }
    // Block popup/ad scripts
    if (/pop(?:up|under|ads|cash)/i.test(match) || 
        /window\.open\s*\(/i.test(match) ||
        /anti.?adblock/i.test(match) ||
        /adblock.?detect/i.test(match) ||
        /DisableDevtool/i.test(match)) {
      return '<!-- ad script blocked -->';
    }
    return match;
  });

  // 3. Remove iframes with ad domains
  html = html.replace(/<iframe[^>]*\s(?:src|data-src)\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi, (match, src) => {
    if (isAdDomain(src)) return '<!-- ad iframe blocked -->';
    return match;
  });

  // 4. Remove link/img tags with ad domains
  html = html.replace(/<(?:link|img)[^>]*(?:href|src)\s*=\s*["']([^"']+)["'][^>]*\/?>/gi, (match, src) => {
    if (isAdDomain(src)) return '<!-- ad resource blocked -->';
    return match;
  });

  // 5. Remove common ad container divs
  html = html.replace(/<div[^>]*(?:id|class)\s*=\s*["'][^"']*(?:ad-|ads-|banner|popup|overlay|interstitial|sticky-ad)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, 
    '<!-- ad div blocked -->');

  // 6. Inject AGGRESSIVE anti-adblock bypass + ad blocking at start
  const bypassScript = `
<script>
(function() {
  'use strict';
  
  // ===== ANTI-ADBLOCK BYPASS =====
  // Create fake ad elements that adblock detectors check for
  var fakeAd = document.createElement('div');
  fakeAd.id = 'ad_position_box';
  fakeAd.className = 'adsbygoogle ad-placement ad-zone textads banner-ads';
  fakeAd.innerHTML = '<div class="ad_box ads adsbox ad-placeholder" style="height:1px;width:1px;position:absolute;left:-9999px;top:-9999px;"></div>';
  fakeAd.style.cssText = 'height:1px;width:1px;position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
  
  var insertFakeAds = function() {
    if (!document.body) return;
    if (!document.getElementById('ad_position_box')) document.body.appendChild(fakeAd);
    // Create multiple fake ad divs with common class names
    ['ad_box','ads','adsbox','ad-banner','ad-placeholder','adUnit','ad-zone','sponsor-ad'].forEach(function(cls) {
      if (!document.querySelector('.' + cls)) {
        var d = document.createElement('div');
        d.className = cls;
        d.style.cssText = 'height:1px;width:1px;position:absolute;left:-9999px;top:-9999px;';
        document.body.appendChild(d);
      }
    });
  };
  
  if (document.body) insertFakeAds();
  else document.addEventListener('DOMContentLoaded', insertFakeAds);
  
  // Override common ad check functions
  window.adblock = false;
  window.canRunAds = true;
  window.isAdBlockActive = false;
  window.adBlockDetected = false;
  window.adBlockEnabled = false;
  window.ads_loaded = true;
  window.adsLoaded = true;
  window.adsbygoogle = window.adsbygoogle || [];
  window.__cmpConsent = true;
  window.fuckAdBlock = { onDetected: function(){}, onNotDetected: function(fn){if(fn)fn();}, check: function(){return false;}, emitEvent: function(){} };
  window.FuckAdBlock = function(){ return window.fuckAdBlock; };
  window.blockAdBlock = window.fuckAdBlock;
  window.BlockAdBlock = window.FuckAdBlock;
  window.sniffAdBlock = { init: function(){} };
  window.google_ad_status = 1;
  
  // Fake googletag
  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];
  window.googletag.pubads = function() { return { addEventListener: function(){}, setTargeting: function(){return this;}, enableSingleRequest: function(){}, collapseEmptyDivs: function(){}, refresh: function(){}, getSlots: function(){return [];} }; };
  window.googletag.enableServices = function(){};
  window.googletag.display = function(){};
  window.googletag.defineSlot = function(){ return { addService: function(){return this;}, setTargeting: function(){return this;} }; };
  
  // Override getComputedStyle for ad element detection
  var _gcs = window.getComputedStyle;
  window.getComputedStyle = function(el) {
    var result = _gcs.apply(this, arguments);
    if (el && el.className && typeof el.className === 'string' && 
        (el.className.includes('ad') || el.className.includes('banner') || el.className.includes('sponsor'))) {
      // Return fake styles that indicate the element is visible
      return new Proxy(result, {
        get: function(target, prop) {
          if (prop === 'display') return 'block';
          if (prop === 'visibility') return 'visible';
          if (prop === 'opacity') return '1';
          if (prop === 'height') return '100px';
          return target[prop];
        }
      });
    }
    return result;
  };
  
  // ===== BLOCK POPUPS & ADS =====
  window.open = function() { return null; };
  document.write = function() {};
  document.writeln = function() {};
  
  // Remove adblock warning overlays periodically
  setInterval(function() {
    // Target remodal (the modal library used by as-cdn21.top for adblock warnings)
    document.querySelectorAll('.remodal-overlay, .remodal-wrapper, [data-remodal-id]').forEach(function(el) {
      el.style.display = 'none';
      el.remove();
    });
    // Remove any overlay with adblock-related text
    document.querySelectorAll('div, section, aside, p, h1, h2, h3, span').forEach(function(el) {
      var text = (el.textContent || '').toLowerCase();
      if ((text.includes('adblock') || text.includes('ad block') || text.includes('ads are not being displayed') || 
           text.includes('disable adblock') || text.includes('sandbox') || text.includes('allow ads')) &&
          !el.querySelector('video') && !el.closest('[class*=player]') && !el.closest('#player') && !el.closest('#playerbase')) {
        el.style.display = 'none';
        el.remove();
      }
    });
    // Remove fixed overlays
    document.querySelectorAll('div').forEach(function(el) {
      var style = getComputedStyle(el);
      if ((style.position === 'fixed' || style.position === 'absolute') && 
          parseInt(style.zIndex) > 99999 &&
          !el.querySelector('video') && !el.closest('#player') && !el.closest('#playerbase') && !el.id?.includes('player')) {
        el.style.display = 'none';
      }
    });
    // Also force-click any "close" buttons on ad overlays
    document.querySelectorAll('.rek_close, [class*=close]').forEach(function(el) {
      if (!el.closest('#player') && !el.closest('#playerbase')) {
        try { el.click(); } catch(e) {}
      }
    });
    // Re-show player if hidden
    var player = document.getElementById('player') || document.getElementById('playerbase');
    if (player) {
      player.style.display = '';
      player.style.visibility = 'visible';
      player.style.opacity = '1';
    }
  }, 300);
  
  // Block fetch/XHR to ad domains
  var adDomains = ${JSON.stringify(AD_DOMAINS)};
  var _fetch = window.fetch;
  window.fetch = function(url) {
    if (typeof url === 'string' && adDomains.some(function(d) { return url.includes(d); })) {
      return Promise.resolve(new Response('', {status: 200}));
    }
    return _fetch.apply(this, arguments);
  };
  
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && adDomains.some(function(d) { return url.includes(d); })) {
      this._blocked = true;
      return;
    }
    return _xhrOpen.apply(this, arguments);
  };
  var _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return _xhrSend.apply(this, arguments);
  };
  
  // Block createElement for ad scripts
  var _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _createElement(tag);
    if (tag.toLowerCase() === 'script') {
      var origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'src' && value && adDomains.some(function(d) { return value.includes(d); })) return;
        return origSetAttr(name, value);
      };
    }
    return el;
  };
})();
</script>
<style>
  /* Hide ad elements and adblock warnings */
  .remodal-overlay, .remodal-wrapper, [data-remodal-id], .rek, .rek_close, .rek_counter,
  [id*="ad-"], [id*="ads-"], [class*="ad-container"], [class*="ad-wrapper"],
  [class*="banner-ad"], [class*="popup"], .overlay-ad, #overlay, .pppx,
  div[style*="z-index: 999995"], div[style*="z-index: 999996"], div[style*="z-index: 999998"],
  a[target="_blank"][rel*="sponsored"] {
    display: none !important;
    pointer-events: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
  }
  body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #000 !important; }
  #player, #playerbase, video, .jw-wrapper, .plyr, [class*=player], iframe { 
    width: 100% !important; 
    height: 100% !important; 
    max-width: 100vw !important;
    max-height: 100vh !important;
    z-index: 10 !important;
  }
</style>`;

  // Inject after <head> or at start
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + bypassScript);
  } else if (html.includes('<head ')) {
    html = html.replace(/<head\s[^>]*>/, '$&' + bypassScript);
  } else if (html.includes('<body')) {
    html = html.replace(/<body[^>]*>/, '$&' + bypassScript);
  } else {
    html = bypassScript + html;
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

    // Determine referer based on URL domain
    let referer = 'https://animesalt.top/';
    try {
      const urlObj = new URL(url);
      referer = urlObj.origin + '/';
    } catch {}

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let html = await response.text();
    
    // Check for error pages
    if (html.includes('<title>Error</title>') || html.includes('Video not found')) {
      const errorHtml = `<!DOCTYPE html><html><head><style>body{margin:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center}h2{font-size:18px;opacity:0.7}</style></head><body><div><h2>⚠️ Video unavailable</h2><p style="opacity:0.5;font-size:14px">Try switching server</p></div></body></html>`;
      return new Response(errorHtml, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'ALLOWALL' },
      });
    }
    
    html = cleanHTML(html, url);

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
