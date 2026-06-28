import type { APIRoute } from 'astro';
import * as cheerio from 'cheerio';
import { getCache, setCache } from '../../../lib/anime-cache';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });
  }

  const cacheKey = `mal:details:v3:${id}`;
  const cached = await getCache<any>(cacheKey, 86400000);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(`https://myanimelist.net/anime/${id}`);
    if (!res.ok) {
      throw new Error(`MAL responded with status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('h1.title-name strong').text().trim(); // Usually Romaji

    // Extract synopsis
    let synopsis = $('p[itemprop="description"]').text().trim();
    // MAL synopsis often ends with [Written by MAL Rewrite]
    synopsis = synopsis.replace(/\[Written by MAL Rewrite\]/g, '').trim();

    // Helper to extract sidebar fields
    const extractField = (label: string) => {
      const el = $(`span.dark_text:contains("${label}")`).parent();
      let text = el.text().replace(label, '').trim();
      // Remove extraneous spaces and newlines
      text = text.replace(/\s+/g, ' ');
      return text || 'Unknown';
    };

    const extractLinks = (label: string) => {
      const el = $(`span.dark_text:contains("${label}")`).parent();
      const links: { name: string }[] = [];
      el.find('a').each((i, link) => {
        links.push({ name: $(link).text().trim() });
      });
      return links;
    };

    const titleNative = extractField('Japanese:');

    const type = extractField('Type:');
    const episodes = extractField('Episodes:');
    const status = extractField('Status:');
    const aired = extractField('Aired:');
    const premiered = extractField('Premiered:');
    const duration = extractField('Duration:');
    
    // Attempt to extract Score
    let score = null;
    const scoreText = $('.score-label').first().text().trim();
    if (scoreText && scoreText !== 'N/A') {
      score = parseFloat(scoreText);
    }

    const studios = extractLinks('Studios:');
    const source = extractField('Source:');
    const rating = extractField('Rating:');
    
    // Some anime use 'Theme:' and others use 'Themes:'
    let themes = extractLinks('Theme:');
    if (themes.length === 0) themes = extractLinks('Themes:');
    
    // Same for Genre
    let genres = extractLinks('Genre:');
    if (genres.length === 0) genres = extractLinks('Genres:');

    // Parse Premiere string into Season and Year
    let season = 'Unknown';
    let year = 'Unknown';
    if (premiered !== 'Unknown') {
      const parts = premiered.split(' ');
      if (parts.length === 2) {
        season = parts[0];
        year = parts[1];
      }
    }

    const titleEnglishHeader = $('h1.title-english').text().trim();
    const titleEnglishSidebar = extractField('English:');
    let titleEnglish = titleEnglishHeader;
    if (!titleEnglish || titleEnglish === 'Unknown') {
      titleEnglish = titleEnglishSidebar !== 'Unknown' ? titleEnglishSidebar : '';
    }

    const data = {
      mal_id: id,
      title: title, // Romaji
      title_english: titleEnglish !== '' ? titleEnglish : null,
      title_native: titleNative !== 'Unknown' ? titleNative : null,
      synopsis: synopsis || 'No synopsis available.',
      episodes: episodes === 'Unknown' ? null : parseInt(episodes, 10),
      duration,
      status,
      season,
      year: parseInt(year, 10) || null,
      type,
      source: source !== 'Unknown' ? source : null,
      rating: rating !== 'Unknown' ? rating : null,
      genres,
      themes,
      studios,
      score,
      aired: { string: aired }
    };

    const responseData = { data };

    // Cache for 24 hours
    await setCache(cacheKey, responseData, 24 * 60 * 60 * 1000);

    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MAL Detail Scrape Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to scrape MAL detail page', details: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
