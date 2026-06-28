import { SignJWT, jwtVerify } from 'jose';

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split('; ')) {
    const [key, ...valParts] = part.split('=');
    if (key === name) return decodeURIComponent(valParts.join('='));
  }
  return null;
}

function getSecret(): Uint8Array {
  const secret = (import.meta as any).env?.JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(secret);
}

export async function verifySession(request: Request) {
  const token = getCookie(request, 'cerydra_session');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return {
      user_id: payload.sub as string,
      username: payload.username as string,
      avatar_hash: (payload.avatar_hash as string) || null,
    };
  } catch {
    return null;
  }
}

export async function createSessionCookie(userId: string, username: string, avatarHash: string | null): Promise<string> {
  const secret = getSecret();
  const token = await new SignJWT({ sub: userId, username, avatar_hash: avatarHash })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
  return `cerydra_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

export function clearSessionCookie(): string {
  return 'cerydra_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}
