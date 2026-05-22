import { auth } from './firebase';

interface TokenResponse {
  token: string;
  wsUrl: string;
}

const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT as string;
export const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_WS_URL as string;

/**
 * Fetches a LiveKit access token from our Cloudflare Worker.
 * The Worker verifies the Firebase ID token, then signs a JWT with the
 * LiveKit API secret (kept in Worker secrets, never in the frontend).
 */
export async function fetchLiveKitToken(
  roomId: string,
  identity: string,
  displayName: string,
): Promise<TokenResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const idToken = await user.getIdToken();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ roomId, identity, displayName }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token mint failed: ${res.status} ${body}`);
  }
  return res.json();
}
