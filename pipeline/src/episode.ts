// Episode doc helpers — updates Firestore so the dashboard sees live status.
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import type { EpisodeStatus } from './types.js';

export async function setStatus(roomId: string, status: EpisodeStatus, patch: Record<string, unknown> = {}) {
  await db.collection('episodes').doc(roomId).set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      ...patch,
    },
    { merge: true },
  );
}

export async function setError(roomId: string, errorMessage: string) {
  await setStatus(roomId, 'failed', { errorMessage });
}

export async function getEpisode(roomId: string) {
  const snap = await db.collection('episodes').doc(roomId).get();
  return snap.exists ? snap.data() : null;
}

export async function getShowSettings() {
  const snap = await db.doc('shows/main').get();
  if (!snap.exists) {
    throw new Error('Show settings not configured. Set them in /settings first.');
  }
  return snap.data() as import('./types.js').ShowSettings;
}
