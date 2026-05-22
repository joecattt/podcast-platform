// Step: run whisper.cpp per-track. Because each guest has their own audio
// track, speaker attribution is FREE — no diarization needed.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import { config } from '../config.js';
import type { ParticipantTrack, TranscriptSegment } from '../types.js';

export async function transcribeTracks(
  tracks: ParticipantTrack[],
  workDir: string,
): Promise<TranscriptSegment[]> {
  const all: TranscriptSegment[] = [];

  for (const t of tracks) {
    const outPrefix = join(workDir, `${t.identity}-transcript`);
    // whisper.cpp emits ${outPrefix}.json with segments.
    await execa(config.whisperBin, [
      '-m', config.whisperModel,
      '-f', t.audioPath,
      '-of', outPrefix,
      '-oj',         // JSON output
      '-pp',         // print progress
      '-l', 'en',
      '-t', '4',     // 4 threads (Cloud Run vCPU)
    ], { stdio: 'inherit' });

    const json = JSON.parse(await readFile(`${outPrefix}.json`, 'utf8'));
    for (const seg of json.transcription ?? []) {
      // whisper.cpp timestamps are in ms as "00:00:01,000" — also exposes ms in `offsets`.
      const startSec = (seg.offsets?.from ?? msFromTs(seg.timestamps?.from)) / 1000;
      const endSec = (seg.offsets?.to ?? msFromTs(seg.timestamps?.to)) / 1000;
      const text = (seg.text ?? '').trim();
      if (!text) continue;
      all.push({ speaker: t.identity, startSec, endSec, text });
    }
  }

  // Sort by start time so we have a unified timeline.
  all.sort((a, b) => a.startSec - b.startSec);
  return all;
}

function msFromTs(ts?: string): number {
  if (!ts) return 0;
  const m = ts.match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  const [, h, mi, s, ms] = m;
  return ((Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000) + Number(ms);
}
