import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    // Fetch top 500 popular anime from AniList for indexing
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query {
          Page(page: 1, perPage: 500) {
            media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
              id
              title { romaji }
            }
          }
        }`
      })
    });
    const json = await res.json();
    const animeList = json?.data?.Page?.media || [];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    animeList.forEach((anime: any) => {
      // Create a URL-friendly slug
      const slug = anime.title.romaji
        ? anime.title.romaji.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : 'anime';
        
      xml += `  <url>\n`;
      xml += `    <loc>https://cerydra.my.id/anime/${anime.id}/${slug}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });
    
    xml += '</urlset>';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400' // Cache for 1 day
      }
    });
  } catch (error) {
    return new Response('Error generating sitemap', { status: 500 });
  }
}
