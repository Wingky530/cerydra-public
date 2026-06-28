import type { APIRoute } from 'astro';
import * as arctic from 'arctic';
import { getEnv } from '../../../lib/env';

export const GET: APIRoute = async ({ redirect, cookies }) => {
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
  const state = arctic.generateState();
  const url = discord.createAuthorizationURL(state, null, ['identify']);

  cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return redirect(url.toString());
};
