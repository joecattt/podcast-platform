import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';

admin.initializeApp();

const LIVEKIT_API_KEY = defineSecret('LIVEKIT_API_KEY');
const LIVEKIT_API_SECRET = defineSecret('LIVEKIT_API_SECRET');
const LIVEKIT_WS_URL = defineSecret('LIVEKIT_WS_URL');

interface MintInput {
  roomId: string;
  identity: string;
  displayName: string;
}

export const mintLiveKitToken = onCall<MintInput>(
  { secrets: [LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL] },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

    const { roomId, identity, displayName } = req.data;
    if (!roomId || !identity || !displayName) {
      throw new HttpsError('invalid-argument', 'roomId, identity, displayName required.');
    }
    if (req.auth.uid !== identity) {
      throw new HttpsError('permission-denied', 'identity must match auth uid.');
    }

    // Confirm room exists.
    const roomDoc = await admin.firestore().collection('rooms').doc(roomId).get();
    if (!roomDoc.exists) throw new HttpsError('not-found', 'Room does not exist.');

    const at = new AccessToken(LIVEKIT_API_KEY.value(), LIVEKIT_API_SECRET.value(), {
      identity,
      name: displayName,
      ttl: 60 * 60 * 4, // 4-hour session
    });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await at.toJwt(),
      wsUrl: LIVEKIT_WS_URL.value(),
    };
  },
);
