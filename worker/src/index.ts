/**
 * Cloudflare Worker — mints LiveKit access tokens.
 *
 * Flow:
 *   1. Client POSTs { roomId, identity, displayName } with Firebase ID
 *      token in the Authorization header.
 *   2. Worker verifies the ID token against Google's JWKS.
 *   3. Worker checks identity matches the authenticated uid.
 *   4. Signs a LiveKit JWT with API key/secret (kept in Worker secrets).
 *   5. Returns { token, wsUrl }.
 */
import { AccessToken } from 'livekit-server-sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_WS_URL: string;
  FIREBASE_PROJECT_ID: string;
}

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com'),
  { cooldownDuration: 5 * 60_000 },
);

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (req.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }

    // 1. Verify Firebase ID token.
    const authHeader = req.headers.get('Authorization') ?? '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) return json({ error: 'missing bearer token' }, 401, origin);

    const issuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
    let uid: string;
    try {
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer,
        audience: env.FIREBASE_PROJECT_ID,
      });
      uid = payload.sub as string;
      if (!uid) throw new Error('no uid');
    } catch (e) {
      return json({ error: 'invalid firebase token', detail: String(e) }, 401, origin);
    }

    // 2. Parse + validate body.
    let body: { roomId?: string; identity?: string; displayName?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400, origin);
    }
    const { roomId, identity, displayName } = body;
    if (!roomId || !identity || !displayName) {
      return json({ error: 'roomId, identity, displayName required' }, 400, origin);
    }
    if (identity !== uid) {
      return json({ error: 'identity must equal authenticated uid' }, 403, origin);
    }

    // 3. Mint LiveKit token.
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: 60 * 60 * 4, // 4 hours
    });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();

    return json({ token, wsUrl: env.LIVEKIT_WS_URL }, 200, origin);
  },
};

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
