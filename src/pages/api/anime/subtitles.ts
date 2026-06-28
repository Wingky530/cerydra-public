import type { APIRoute } from 'astro';

export const prerender = false;

function formatAssTime(t: string): string {
  const match = t.match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2];
    const s = match[3];
    const ms = match[4] + '0';
    return `${h}:${m}:${s}.${ms}`;
  }
  return t;
}

function convertAssToVtt(assContent: string): string {
  const lines = assContent.split(/\r?\n/);
  let vtt = 'WEBVTT\n\n';
  
  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      // Format: Dialogue: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      // Example: Dialogue: 0,0:01:20.10,0:01:23.40,Default,,0,0,0,,Hello world
      const parts = line.split(',');
      if (parts.length >= 10) {
        const start = parts[1].trim();
        const end = parts[2].trim();
        
        // Extract the text part (can contain commas, so join the rest)
        const rawText = parts.slice(9).join(',');
        // Clean ASS tags like {\pos(400,900)} or {\i1} and replace \N with newline
        const cleanText = rawText
          .replace(/\\N/g, '\n')
          .replace(/\{[^}]*\}/g, '')
          .trim();
          
        vtt += `${formatAssTime(start)} --> ${formatAssTime(end)}\n${cleanText}\n\n`;
      }
    }
  }
  return vtt;
}

function convertSrtToVtt(srtContent: string): string {
  // Replace comma with dot in timestamps (e.g. 00:01:20,100 -> 00:01:20.100)
  const converted = srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  // Strip UTF-8 BOM if present
  const clean = converted.startsWith('\uFEFF') ? converted.slice(1) : converted;
  return 'WEBVTT\n\n' + clean;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const anilistId = url.searchParams.get('anilistId');
  const episode = url.searchParams.get('episode');
  const downloadUrl = url.searchParams.get('downloadUrl');

  const apiKey = import.meta.env.JIMAKU_API_KEY || process.env.JIMAKU_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'JIMAKU_API_KEY is not configured on the server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. If downloadUrl is directly provided, fetch the file, convert it, and return VTT
  if (downloadUrl) {
    try {
      const res = await fetch(downloadUrl, {
        headers: {
          'Authorization': apiKey,
        },
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch subtitle file from Jimaku: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const content = await res.text();
      let vttContent = '';

      if (downloadUrl.endsWith('.ass')) {
        vttContent = convertAssToVtt(content);
      } else if (downloadUrl.endsWith('.srt')) {
        vttContent = convertSrtToVtt(content);
      } else if (downloadUrl.endsWith('.vtt')) {
        vttContent = content;
      } else {
        // Fallback: try to guess or return as is
        vttContent = content.includes('Dialogue:') ? convertAssToVtt(content) : convertSrtToVtt(content);
      }

      return new Response(vttContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `Conversion failed: ${e.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. Otherwise, perform the search and list matching files
  if (!anilistId || !episode) {
    return new Response(JSON.stringify({ error: 'Parameters anilistId and episode (or downloadUrl) are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Step 2.1: Search for entry by AniList ID
    const searchRes = await fetch(`https://jimaku.cc/api/entries/search?anilist_id=${anilistId}`, {
      headers: {
        'Authorization': apiKey,
      },
    });

    if (!searchRes.ok) {
      const errData = await searchRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: `Jimaku search failed: ${errData.error || searchRes.statusText}` }), {
        status: searchRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entries = await searchRes.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ subtitles: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entryId = entries[0].id;

    // Step 2.2: Fetch files for this entry
    const filesRes = await fetch(`https://jimaku.cc/api/entries/${entryId}/files`, {
      headers: {
        'Authorization': apiKey,
      },
    });

    if (!filesRes.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch files from Jimaku: ${filesRes.statusText}` }), {
        status: filesRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const files = await filesRes.json();
    if (!Array.isArray(files)) {
      return new Response(JSON.stringify({ subtitles: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2.3: Match files by episode number
    // Match episode patterns like: e01, ep01, - 01, _01, 01.ass, etc.
    const padEpisode = episode.padStart(2, '0');
    const epRegex = new RegExp(`(?:[^\\d]|^)(?:0*${episode}|${padEpisode})(?:[^\\d]|$)`, 'i');

    const matchedFiles = files.filter((file: any) => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const isSubFormat = ['.ass', '.srt', '.vtt'].includes(ext);
      return isSubFormat && epRegex.test(file.name);
    });

    const subtitles = matchedFiles.map((file: any) => {
      // Build dynamic conversion URL proxying back to this API
      const selfUrl = new URL(request.url);
      selfUrl.searchParams.delete('anilistId');
      selfUrl.searchParams.delete('episode');
      selfUrl.searchParams.set('downloadUrl', file.url);

      return {
        name: file.name,
        url: selfUrl.toString(),
        lang: 'Japanese', // Jimaku is Japanese subtitles
        label: `Japanese (${file.name.substring(file.name.lastIndexOf('.') + 1).toUpperCase()})`,
      };
    });

    return new Response(JSON.stringify({ subtitles }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
