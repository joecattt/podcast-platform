// Step: concat WebM chunks → single MP4 per guest, then loudness-normalize,
// de-noise (RNNoise via ffmpeg-aresample), de-ess, mild EQ.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import type { ParticipantChunks } from '../storage.js';
import type { ParticipantTrack } from '../types.js';

export async function stitchAndCleanAudio(
  participants: ParticipantChunks[],
  workDir: string,
): Promise<ParticipantTrack[]> {
  const out: ParticipantTrack[] = [];

  for (const p of participants) {
    // 1. Build ffconcat list, concat WebM chunks losslessly.
    const listPath = join(workDir, `${p.identity}.list`);
    const listBody = p.chunkPaths.map((c) => `file '${c.replace(/'/g, `'\\''`)}'`).join('\n');
    await writeFile(listPath, listBody);

    const stitchedWebm = join(workDir, `${p.identity}.webm`);
    await execa('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      stitchedWebm,
    ]);

    // 2. Transcode to MP4 (h264 + aac) + apply audio chain in one pass.
    //    Audio chain (per Riverside-style cleanup):
    //      - highpass 70hz (remove rumble)
    //      - afftdn (FFT denoise; mild, free alt to RNNoise that ships with ffmpeg)
    //      - deesser (tame sibilance)
    //      - equalizer presence lift around 3kHz
    //      - loudnorm (target -16 LUFS, podcast-friendly)
    const videoMp4 = join(workDir, `${p.identity}.mp4`);
    const audioWav = join(workDir, `${p.identity}.wav`);

    await execa('ffmpeg', [
      '-y',
      '-i', stitchedWebm,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-af',
        'highpass=f=70,' +
        'afftdn=nf=-25,' +
        'deesser=i=0.4,' +
        'equalizer=f=3000:t=q:w=2:g=2,' +
        'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:a', 'aac',
      '-b:a', '192k',
      videoMp4,
    ]);

    // 3. Also extract a clean WAV per track — used for Whisper transcription
    //    (whisper.cpp wants 16kHz mono WAV).
    await execa('ffmpeg', [
      '-y',
      '-i', videoMp4,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      audioWav,
    ]);

    out.push({
      identity: p.identity,
      displayName: p.displayName,
      videoPath: videoMp4,
      audioPath: audioWav,
    });
  }

  return out;
}
