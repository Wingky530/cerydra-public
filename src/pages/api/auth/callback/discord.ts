import type { APIRoute } from 'astro';
import * as arctic from 'arctic';
import client from '../../../../lib/turso';
import { createSessionCookie } from '../../../../lib/auth';
import { getEnv } from '../../../../lib/env';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = cookies.get('discord_oauth_state')?.value;

    if (!code || !state || state !== storedState) {
      return new Response('Invalid request', { status: 400 });
    }

    const clientId = getEnv('DISCORD_CLIENT_ID');
    const clientSecret = getEnv('DISCORD_CLIENT_SECRET');

    const isDev = (import.meta as any).env?.DEV === true;
    const redirectUri = isDev
      ? (getEnv('DISCORD_REDIRECT_URI_DEV') || getEnv('DISCORD_REDIRECT_URI'))
      : getEnv('DISCORD_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      return new Response('Discord OAuth not configured', { status: 500 });
    }

    const discord = new arctic.Discord(clientId, clientSecret, redirectUri);
    const tokens = await discord.validateAuthorizationCode(code, null);
    const accessToken = tokens.accessToken();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return new Response('Failed to fetch user', { status: 502 });
    }

    const discordUser = await userRes.json();
    const avatarHash = discordUser.avatar || null;

    await client.execute(
      `INSERT INTO users (id, username, avatar, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar`,
      [discordUser.id, discordUser.username, avatarHash, Date.now()]
    );

    const cookieHeader = await createSessionCookie(discordUser.id, discordUser.username, avatarHash);

    cookies.delete('discord_oauth_state', { path: '/' });

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (e) {
    console.error('Discord callback error:', e);
    return new Response('Authentication failed', { status: 500 });
  }
};
