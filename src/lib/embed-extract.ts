const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';

function extractVideoUrl(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function extractOkru(html: string): string | null {
  try {
    const dataOptionsMatch = html.match(/data-options=(?:'|")([^'"]+)(?:'|")/i);
    if (dataOptionsMatch) {
      const optionsStr = dataOptionsMatch[1].replace(/&quot;/g, '"');
      const options = JSON.parse(optionsStr);

      const metadataStr = options?.flashvars?.metadata;
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        if (metadata.ondemandHls) return metadata.ondemandHls;
        if (metadata.ondemandDash) return metadata.ondemandDash;
        if (metadata.videos && metadata.videos.length > 0) {
          // Typically returns the best quality or first available
          return metadata.videos[0].url;
        }
      }
    }
  } catch (e) {
    console.error('[embed-extract] Ok.ru JSON parse error:', e);
  }

  // Fallback patterns
  return extractVideoUrl(html, [
    /\\&quot;ondemandHls\\&quot;:\\&quot;([^\\&]+)\\&quot;/i,
    /\\&quot;url\\&quot;:\\&quot;([^\\&]+\.(?:mp4|m3u8)[^\\&]*)\\&quot;/i,
    /"hlsUrl"\s*:\s*"([^"]+)"/i,
    /"videoUrl"\s*:\s*"([^"]+)"/i,
    /"url"\s*:\s*"([^"]+\.(?:mp4|m3u8)[^"]*)"/i,
    /<meta\s+property="og:video(?:|:secure_url)"\s+content="([^"]+)"/i,
    /data-video-url\s*=\s*["']([^"']+)/i,
  ]);
}

export function extractMp4upload(html: string): string | null {
  return extractVideoUrl(html, [
    /player\.src\(\{\s*src:\s*["']([^"']+)["']/i,
    /src\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
    /file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
    /sources\s*:\s*\[[^\]]*?src:\s*["']([^"']+)["']/i,
    /"src"\s*:\s*"([^"]+\.mp4[^"]*)"/i,
    /'src'\s*:\s*'([^']+\.mp4[^']*)'/i,
    /<source\s+src=["']([^"']+\.mp4[^"']*)["']/i,
    /download_video\s*=\s*["']([^"']+)/i,
    /video_url\s*=\s*["']([^"']+)/i,
  ]);
}

export function extractStreamwish(html: string): string | null {
  return extractVideoUrl(html, [
    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i,
    /file\s*:\s*["']([^"']+)["']/i,
    /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /<source\s+src=["']([^"']+)["']/i,
    /hlsUrl\s*:\s*["']([^"']+)["']/i,
  ]);
}

export function extractListeamed(html: string): string | null {
  return extractVideoUrl(html, [
    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i,
    /playlist\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i,
    /file\s*:\s*["']([^"']+)["']/i,
    /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /<source\s+src=["']([^"']+)["']/i,
    /hlsUrl\s*:\s*["']([^"']+)["']/i,
  ]);
}

export function extractGeneric(html: string): string | null {
  return extractVideoUrl(html, [
    /<meta\s+property="og:video(?::secure_url)?"\s+content="([^"]+\.(?:mp4|m3u8)[^"]*)"/i,
    /<meta\s+property="og:video"\s+content="([^"]+\.(?:mp4|m3u8)[^"]*)"/i,
    /"url"\s*:\s*"([^"]+\.(?:mp4|m3u8)[^"]*)"/i,
    /"src"\s*:\s*"([^"]+\.(?:mp4|m3u8)[^"]*)"/i,
    /<source\s+src=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i,
  ]);
}

export async function fetchEmbed(url: string, signal?: AbortSignal, referer?: string) {
  // normalize mp4upload to avoid 301 redirects
  let targetUrl = url;
  if (targetUrl.includes('mp4upload.com') && !targetUrl.includes('www.mp4upload.com')) {
    targetUrl = targetUrl.replace('mp4upload.com', 'www.mp4upload.com');
  }

  // Fetch via Cloudflare Worker proxy to bypass WAF/WAF block and align IP
  const customReferer = referer || new URL(targetUrl).origin + '/';
  const proxyBase = typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_VIDEO_PROXY_URL || 'https://cerydra-video-proxy.wingky530-id.workers.dev' : process.env.PUBLIC_VIDEO_PROXY_URL || 'https://cerydra-video-proxy.wingky530-id.workers.dev';
  const proxyUrl = `${proxyBase}/?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(customReferer)}`;
  const res = await fetch(proxyUrl, {
    headers: { 'User-Agent': 'Cerydra-Backend/1.0', 'Referer': customReferer },
    signal,
  });

  if (!res.ok) {
    try {
      const text = await res.clone().text();
      console.error(`[fetchEmbed] Failed proxy request to: ${proxyUrl} | Status: ${res.status} | Body snippet:`, text.slice(0, 1000));
    } catch (e) {
      // ignore
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

export function unpackPacker(html: string): string | null {
  const match = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)\s*\{[\s\S]*?return\s+p\s*\}\s*\(\s*['"]([\s\S]+?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]+?)['"]\.split\s*\(\s*['"]\|['"]\s*\)/i);
  if (!match) return null;
  
  let p = match[1];
  const a = parseInt(match[2], 10);
  let c = parseInt(match[3], 10);
  const k = match[4].split('|');
  
  const e = (c: number): string => {
    return (c < a ? '' : e(Math.floor(c / a))) + 
      ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
  };
  
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

export function extractVidhide(html: string, embedUrl: string): string | null {
  try {
    const unpacked = unpackPacker(html);
    if (!unpacked) return null;
    
    const linksMatch = unpacked.match(/var\s+links\s*=\s*(\{[\s\S]*?\})/i);
    if (linksMatch) {
      const objStr = linksMatch[1];
      const hls4Match = objStr.match(/"hls4"\s*:\s*"([^"]+)"/i);
      const hls2Match = objStr.match(/"hls2"\s*:\s*"([^"]+)"/i);
      
      let hls4 = hls4Match?.[1];
      let hls2 = hls2Match?.[1];
      
      if (hls4 && hls4.startsWith('/')) {
        hls4 = new URL(embedUrl).origin + hls4;
      }
      
      if (hls4) return hls4;
      if (hls2) return hls2;
    }
    
    const m3u8Match = unpacked.match(/https?:\/\/[^"'\s>]+?\.m3u8[^"'\s>]*?/i);
    if (m3u8Match) return m3u8Match[0];
  } catch (err) {
    console.error('[embed-extract] Vidhide extraction error:', err);
  }
  return null;
}

export function extractFiledon(html: string): string | null {
  try {
    const appMatch = html.match(/id="app"\s+data-page="([^"]+)"/i);
    if (appMatch) {
      const decodedJson = appMatch[1].replace(/&quot;/g, '"');
      const data = JSON.parse(decodedJson);
      const directUrl = data.props?.url || data.props?.files?.url;
      if (directUrl && typeof directUrl === 'string') {
        return directUrl.replace(/&amp;/g, '&');
      }
    }
  } catch (e) {
    console.error('[embed-extract] Filedon extraction error:', e);
  }
  return null;
}

export function extractDesustream(html: string): string | null {
  try {
    // 1. <source src="..."> — moeplay style
    const srcTag = html.match(/<source\s+src="([^"]+)"\s+type="video\/mp4"/i)
      ?? html.match(/<source\s+src="([^"]+)"/i);
    if (srcTag?.[1]) return srcTag[1];

    // 2. file: "..." — arcg/odstream player.js style
    // var vs = {..., file: "https://archive.org/..."};
    const fileVar = html.match(/[,{]\s*file\s*:\s*"([^"]+)"/i);
    if (fileVar?.[1]) return fileVar[1];

    // 3. file: '...' single-quoted variant
    const fileVarSingle = html.match(/[,{]\s*file\s*:\s*'([^']+)'/i);
    if (fileVarSingle?.[1]) return fileVarSingle[1];

    // 4. updesu: embeds blogger.com video iframe — extract token-based src
    const bloggerMatch = html.match(/src="(https:\/\/www\.blogger\.com\/video\.g\?token=[^"]+)"/i);
    if (bloggerMatch?.[1]) return bloggerMatch[1];

  } catch (e) {
    console.error('[embed-extract] Desustream extraction error:', e);
  }
  return null;
}

export async function extractYourUpload(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    let yuId = '';
    const idMatch = url.match(/id=([a-zA-Z0-9]+)/);
    if (idMatch) {
      yuId = idMatch[1];
    } else {
      const parts = url.split('/');
      yuId = parts[parts.length - 1];
    }
    
    if (!yuId) return null;
    
    const yuUrl = `https://yourupload.com/embed/${yuId}`;
    // Fetch directly, no proxy needed for yourupload meta extraction
    const res = await fetch(yuUrl, {
      headers: { 'User-Agent': AGENT, 'Referer': 'https://www.yourupload.com/' },
      signal,
    });
    
    if (!res.ok) return null;
    
    const html = await res.text();
    const ogVideo = html.match(/property="og:video"\s+content="([^"]+)"/i);
    if (ogVideo && ogVideo[1]) {
      return ogVideo[1];
    }
  } catch (e) {
    console.error('[embed-extract] YourUpload extraction error:', e);
  }
  return null;
}

