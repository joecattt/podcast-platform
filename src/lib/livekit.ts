import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface TokenResponse {
  token: string;
  wsUrl: string;
}

/**
 * Fetches a LiveKit access token from our Firebase Function.
 * The function validates the caller's Firebase auth and signs a JWT
 * with the LiveKit API secret (server-side only).
 */
export async function fetchLiveKitToken(roomId: string, identity: string, displayName: string): Promise<TokenResponse> {
  const call = httpsCallable<{ roomId: string; identity: string; displayName: string }, TokenResponse>(
    functions,
    'mintLiveKitToken',
  );
  const result = await call({ roomId, identity, displayName });
  return result.data;
}

export const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_WS_URL as string;
