// Top-level pipeline orchestrator. Each step updates the episode doc so the
// host can watch progress live from /episodes.
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setStatus } from './episode.js';
import { downloadParticipantChunks, uploadEpisodeAsset } from './storage.js';
import { stitchAndCleanAudio } from './steps/stitch.js';
import { transcribeTracks } from './steps/transcribe.js';
import { buildEditPlan } from './steps/edit-plan.js';
import { renderFinalVideo } from './steps/render.js';
import { generateShorts } from './steps/shorts.js';
import { generateSeoMetadata } from './steps/seo.js';
import { getEpisode, getShowSettings } from './episode.js';
import { db } from './firebase.js';

export async function processRoom(roomId: string) {
  const workDir = join(tmpdir(), `pp-${roomId}-${Date.now()}`);
  await mkdir(workDir, { recursive: true });
  console.log(`[${roomId}] workDir=${workDir}`);

  try {
    // 0. Sanity-load episode + show settings.
    const episode = await getEpisode(roomId);
    if (!episode) throw new Error(`No episode doc for room ${roomId}`);
    const show = await getShowSettings();

    // 1. Download all recorded chunks per participant.
    await setStatus(roomId, 'queued');
    const participants = await downloadParticipantChunks(roomId, workDir);
    if (participants.length === 0) throw new Error('No recordings found for this room');

    // 2. Stitch chunks per participant + audio cleanup.
    await setStatus(roomId, 'stitching');
    const tracks = await stitchAndCleanAudio(participants, workDir);

    // 3. Transcribe each track separately (clean speaker labels for free).
    await setStatus(roomId, 'transcribing');
    const transcript = await transcribeTracks(tracks, workDir);

    // 4. Editorial plan: cuts (silences) + multicam timeline.
    await setStatus(roomId, 'editing');
    const editPlan = await buildEditPlan(tracks, transcript, workDir);

    // 5. Render final video with Remotion (intro + body + lower-thirds).
    await setStatus(roomId, 'rendering');
    const finalLocal = await renderFinalVideo(tracks, editPlan, show, workDir);
    const finalUpload = await uploadEpisodeAsset(roomId, 'final.mp4', finalLocal);

    // 6. Generate AI Shorts.
    await setStatus(roomId, 'shorts');
    const shortsPaths = await generateShorts(roomId, tracks, editPlan, show, workDir);

    // 7. AI SEO metadata.
    const seo = await generateSeoMetadata(editPlan, show);

    // 8. Persist final paths + metadata, mark uploaded.
    await db.collection('episodes').doc(roomId).set(
      {
        finalVideoPath: finalUpload.path,
        finalVideoUrl: finalUpload.url,
        durationSec: editPlan.durationSec,
        shortsPaths,
        seoTitle: seo.title,
        seoDescription: seo.description,
        seoTags: seo.tags,
      },
      { merge: true },
    );
    await setStatus(roomId, 'uploaded');
    console.log(`[${roomId}] ✅ done`);
  } finally {
    // Cleanup tmp work dir.
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
