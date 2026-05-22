// Firebase Storage helpers — download recording chunks for a room,
// upload rendered episode assets.
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { bucket } from './firebase.js';

export interface ParticipantChunks {
  identity: string;
  displayName: string;
  chunkPaths: string[]; // local fs paths, sorted by chunk index
}

/**
 * Downloads every chunk for every participant in a room.
 * Storage layout: recordings/{roomId}/{identity}/chunk-NNNNNN.webm
 */
export async function downloadParticipantChunks(
  roomId: string,
  workDir: string,
): Promise<ParticipantChunks[]> {
  const [files] = await bucket.getFiles({ prefix: `recordings/${roomId}/` });
  if (files.length === 0) return [];

  // Group by identity (the folder right under roomId).
  const byIdentity = new Map<string, typeof files>();
  for (const f of files) {
    // recordings/<roomId>/<identity>/<file>
    const parts = f.name.split('/');
    if (parts.length < 4) continue;
    const identity = parts[2];
    if (!byIdentity.has(identity)) byIdentity.set(identity, []);
    byIdentity.get(identity)!.push(f);
  }

  const results: ParticipantChunks[] = [];
  for (const [identity, group] of byIdentity) {
    const dir = join(workDir, 'raw', identity);
    await mkdir(dir, { recursive: true });

    // Sort by chunk filename so concat order is correct.
    group.sort((a, b) => a.name.localeCompare(b.name));

    const chunkPaths: string[] = [];
    for (const f of group) {
      const local = join(dir, basename(f.name));
      await pipeline(f.createReadStream(), createWriteStream(local));
      chunkPaths.push(local);
    }
    results.push({
      identity,
      displayName: identity, // overwritten later from LiveKit metadata if we have it
      chunkPaths,
    });
  }

  // Try to enrich displayName from rooms/{roomId}/participants/{uid} if it exists.
  // (Optional — pipeline still works without.)
  return results;
}

export async function uploadEpisodeAsset(
  roomId: string,
  filename: string,
  localPath: string,
): Promise<{ path: string; url: string }> {
  const remotePath = `episodes/${roomId}/${filename}`;
  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: { contentType: guessMime(filename) },
  });
  const file = bucket.file(remotePath);
  // Long-lived signed URL — Cloud Storage doesn't expose Firebase download tokens to admin SDK.
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1y
  });
  return { path: remotePath, url };
}

function guessMime(filename: string): string {
  if (filename.endsWith('.mp4')) return 'video/mp4';
  if (filename.endsWith('.webm')) return 'video/webm';
  if (filename.endsWith('.wav')) return 'audio/wav';
  if (filename.endsWith('.mp3')) return 'audio/mpeg';
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.srt')) return 'application/x-subrip';
  return 'application/octet-stream';
}

export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const name of await readdir(dir)) {
    const s = await stat(join(dir, name));
    total += s.size;
  }
  return total;
}
