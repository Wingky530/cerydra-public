import * as cheerio from 'cheerio';

export function getSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  return 0;
}

export const fetchWithRetry = async (url: string, options: any, maxRetries = 2) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
    }
  }
  return null;
};

export async function checkAnichinMaxEpisodes(titles: string[]): Promise<number> {
  const baseUrl = 'https://anichin.com.co';
  const proxyBase = process.env.PUBLIC_VIDEO_PROXY_URL || 'https://cerydra-video-proxy.wingky530-id.workers.dev';
  const proxyUrl = `${proxyBase}/?url=`;
  
  let searchResults: { title: string; url: string; queryTitle: string }[] = [];
  
  for (const t of titles) {
    if (!t) continue;
    const cleanTitle = t.replace(/^#\d+\s+/, '').trim();
    const searchTitle = cleanTitle
      .replace(/((?:Season\s+\d+|\d+(?:th|nd|rd|st)\s+Season))\s*:.*$/i, '$1')
      .replace(/(\d+)(?:th|nd|rd|st)\s+Season/gi, 'Season $1')
      .trim();

    const targetSearch = `${baseUrl}/?s=${encodeURIComponent(searchTitle)}`;
    try {
      const searchRes = await fetchWithRetry(`${proxyUrl}${encodeURIComponent(targetSearch)}`, {
        headers: { 'User-Agent': 'Cerydra-Backend/1.0' }
      });
      if (!searchRes || !searchRes.ok) continue;
      
      const searchHtml = await searchRes.text();
      let $ = cheerio.load(searchHtml);
      
      $('.bsx a').each((i, el) => {
        const titleAttr = $(el).attr('title');
        const u = $(el).attr('href');
        if (titleAttr && u && !searchResults.find(r => r.url === u)) {
          searchResults.push({ title: titleAttr.trim(), url: u, queryTitle: cleanTitle });
        }
      });
      if (searchResults.length > 0) break;
    } catch(e) {}
  }
  
  if (searchResults.length === 0) return 0;
  
  let bestMatch = searchResults[0];
  let maxSim = -999;
  for (const r of searchResults) {
    const sim = getSimilarity(r.queryTitle, r.title);
    if (sim > maxSim) {
      maxSim = sim;
      bestMatch = r;
    }
  }
    
  const animeRes = await fetchWithRetry(`${proxyUrl}${encodeURIComponent(bestMatch.url)}`, {
    headers: { 'User-Agent': 'Cerydra-Backend/1.0' }
  });
  if (!animeRes || !animeRes.ok) return 0;
  const animeHtml = await animeRes.text();
  const $ = cheerio.load(animeHtml);
  
  let maxEp = 0;
  $('.eplister ul li a').each((i, el) => {
    const epNumText = $(el).find('.epl-num').text().trim();
    const match = epNumText.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxEp) maxEp = n;
    }
  });
  return maxEp;
}
