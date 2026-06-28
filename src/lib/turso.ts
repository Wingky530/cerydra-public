import { createClient } from '@libsql/client';

function getEnv(name: string): string | undefined {
  if (typeof import.meta !== 'undefined') {
    const val = (import.meta as any).env?.[name];
    if (val) return val;
  }
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name];
  return undefined;
}

function getClient() {
  const url = getEnv('TURSO_DB_URL') || 'file:local.db';
  const authToken = getEnv('TURSO_DB_AUTH_TOKEN');
  return createClient({ url, authToken });
}

const client = getClient();

export default client;
