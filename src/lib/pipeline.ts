import { auth } from './firebase';

const PIPELINE_ENDPOINT = import.meta.env.VITE_PIPELINE_ENDPOINT as string | undefined;

/**
 * Triggers the Cloud Run pipeline service for a finished room.
 * The service handles: stitch → audio cleanup → transcribe → cut silences →
 * multicam plan → Remotion render → AI Shorts → SEO metadata → upload.
 *
 * Frontend just fires-and-forgets; status updates flow through the
 * episodes/{roomId} Firestore doc.
 */
export async function triggerPipeline(roomId: string): Promise<void> {
  if (!PIPELINE_ENDPOINT) {
    console.warn('VITE_PIPELINE_ENDPOINT not set — pipeline trigger skipped');
    return;
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const idToken = await user.getIdToken();

  const res = await fetch(`${PIPELINE_ENDPOINT}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ roomId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pipeline trigger failed: ${res.status} ${body}`);
  }
}
