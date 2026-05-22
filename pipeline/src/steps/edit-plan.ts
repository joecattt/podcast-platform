// Step: build the editorial plan.
//   - cuts: gaps ≥ silenceThresholdSec where NO ONE is talking AND no
//     non-speaker has reaction-level audio (laugh/exclamation).
//   - multicam: 2 guests → grid for whole episode; 3+ → active speaker
//     by default, brief reactor cutaways when their audio spikes during
//     someone else's line.
import { execa } from 'execa';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import type {
  CutRange,
  EditPlan,
  MulticamSegment,
  ParticipantTrack,
  TranscriptSegment,
} from '../types.js';

const REACTOR_PEAK_DB = -28; // dB threshold to count as a reaction during silence

export async function buildEditPlan(
  tracks: ParticipantTrack[],
  transcript: TranscriptSegment[],
  workDir: string,
): Promise<EditPlan> {
  // 1. Episode duration = longest track.
  const durationSec = await detectDuration(tracks[0].videoPath);

  // 2. Volume timeline per track at 100ms granularity.
  const volume = await Promise.all(tracks.map((t) => sampleVolume(t.audioPath, durationSec, workDir, t.identity)));

  // 3. Cut plan: find gaps ≥ threshold where:
  //    - No transcript segment overlaps this gap
  //    - No participant's audio exceeds REACTOR_PEAK_DB during gap (so a
  //      silent laugh / exclamation preserves the moment).
  const cuts = findSilentGaps(transcript, volume, tracks, durationSec, config.silenceThresholdSec);

  // 4. Multicam plan.
  const multicam = buildMulticam(tracks, transcript, volume, durationSec);

  const guestNames: Record<string, string> = {};
  for (const t of tracks) guestNames[t.identity] = t.displayName;

  return {
    durationSec,
    cuts,
    multicam,
    transcript,
    guestNames,
  };
}

async function detectDuration(videoPath: string): Promise<number> {
  const { stdout } = await execa('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ]);
  return Number(stdout.trim());
}

// Sample RMS volume in dB every 100ms via ffmpeg's astats filter (frame-mode).
async function sampleVolume(
  audioPath: string,
  durationSec: number,
  workDir: string,
  identity: string,
): Promise<Float32Array> {
  const sampleHz = 10;
  const samples = Math.ceil(durationSec * sampleHz);

  const logPath = join(workDir, `${identity}-vol.log`);
  // astats measures per frame; we resample to fixed-rate frames first.
  await execa('ffmpeg', [
    '-y',
    '-i', audioPath,
    '-af', `aresample=async=1,asetnsamples=n=1600,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=${logPath}`,
    '-f', 'null', '-',
  ]);

  // Parse log: frames produce lines like "lavfi.astats.Overall.RMS_level=-23.456"
  const fs = await import('node:fs/promises');
  const text = await fs.readFile(logPath, 'utf8');
  const values: number[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/RMS_level=(-?[\d.]+|-?inf)/);
    if (m) {
      const v = m[1] === '-inf' || m[1] === '-Inf' ? -120 : Number(m[1]);
      values.push(v);
    }
  }
  // Pad/truncate to expected length.
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) arr[i] = values[i] ?? -120;
  return arr;
}

function findSilentGaps(
  transcript: TranscriptSegment[],
  volume: Float32Array[],
  tracks: ParticipantTrack[],
  durationSec: number,
  thresholdSec: number,
): CutRange[] {
  // Sort speech segments by start.
  const speech = [...transcript].sort((a, b) => a.startSec - b.startSec);
  // Merge overlapping speech ranges into a coverage set.
  const coverage: { start: number; end: number }[] = [];
  for (const s of speech) {
    const last = coverage[coverage.length - 1];
    if (last && s.startSec <= last.end + 0.2) {
      last.end = Math.max(last.end, s.endSec);
    } else {
      coverage.push({ start: s.startSec, end: s.endSec });
    }
  }

  const gaps: CutRange[] = [];
  let cursor = 0;
  for (const c of coverage) {
    if (c.start - cursor >= thresholdSec) {
      gaps.push({ startSec: cursor, endSec: c.start });
    }
    cursor = c.end;
  }
  if (durationSec - cursor >= thresholdSec) {
    gaps.push({ startSec: cursor, endSec: durationSec });
  }

  // Filter out gaps with reaction-level audio on any track (preserve laughs).
  return gaps.filter((g) => !hasReaction(g, volume, tracks));
}

function hasReaction(gap: CutRange, volume: Float32Array[], _tracks: ParticipantTrack[]): boolean {
  const sampleHz = 10;
  const from = Math.floor(gap.startSec * sampleHz);
  const to = Math.ceil(gap.endSec * sampleHz);
  for (const v of volume) {
    for (let i = from; i < to && i < v.length; i++) {
      if (v[i] > REACTOR_PEAK_DB) return true;
    }
  }
  return false;
}

function buildMulticam(
  tracks: ParticipantTrack[],
  transcript: TranscriptSegment[],
  volume: Float32Array[],
  durationSec: number,
): MulticamSegment[] {
  // 2 guests → grid for the whole episode.
  if (tracks.length <= 2) {
    return [{ startSec: 0, endSec: durationSec, layout: 'grid' }];
  }

  // 3+ guests → solo on the active speaker, with reactor cutaways.
  // Greedy timeline from sorted transcript segments; in any gap with no
  // dominant speaker, fall back to grid briefly.
  const out: MulticamSegment[] = [];
  const sampleHz = 10;

  for (let i = 0; i < transcript.length; i++) {
    const seg = transcript[i];
    out.push({
      startSec: seg.startSec,
      endSec: seg.endSec,
      layout: 'solo',
      primarySpeaker: seg.speaker,
    });
    // Detect reactor: during this segment, who else peaks loudly briefly?
    const reactor = detectReactor(seg, volume, tracks);
    if (reactor) {
      const reactStart = (reactor.peakIdx / sampleHz) - 0.5;
      const reactEnd = Math.min(seg.endSec, reactStart + 1.2);
      if (reactStart > seg.startSec + 0.5 && reactEnd < seg.endSec - 0.5) {
        out.push({
          startSec: reactStart,
          endSec: reactEnd,
          layout: 'solo',
          primarySpeaker: reactor.identity,
          reactionCutaway: true,
        });
      }
    }
  }

  // Fill any uncovered gaps with grid.
  out.sort((a, b) => a.startSec - b.startSec);
  const filled: MulticamSegment[] = [];
  let cursor = 0;
  for (const m of out) {
    if (m.startSec > cursor + 0.3) {
      filled.push({ startSec: cursor, endSec: m.startSec, layout: 'grid' });
    }
    filled.push(m);
    cursor = Math.max(cursor, m.endSec);
  }
  if (cursor < durationSec - 0.3) {
    filled.push({ startSec: cursor, endSec: durationSec, layout: 'grid' });
  }
  return filled;
}

function detectReactor(
  seg: TranscriptSegment,
  volume: Float32Array[],
  tracks: ParticipantTrack[],
): { identity: string; peakIdx: number } | null {
  const sampleHz = 10;
  const from = Math.floor(seg.startSec * sampleHz);
  const to = Math.ceil(seg.endSec * sampleHz);
  let best: { identity: string; peakIdx: number; level: number } | null = null;
  for (let t = 0; t < tracks.length; t++) {
    if (tracks[t].identity === seg.speaker) continue; // skip the active speaker
    const v = volume[t];
    for (let i = from; i < to && i < v.length; i++) {
      if (v[i] > REACTOR_PEAK_DB && (!best || v[i] > best.level)) {
        best = { identity: tracks[t].identity, peakIdx: i, level: v[i] };
      }
    }
  }
  return best;
}

// Surface for debugging — caller can dump the plan to disk.
export async function writePlanForDebug(plan: EditPlan, workDir: string) {
  await writeFile(join(workDir, 'edit-plan.json'), JSON.stringify(plan, null, 2));
}
