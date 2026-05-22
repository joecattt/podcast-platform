// Step: generate AI Shorts.
//   1. Claude reads the transcript + audio volume reactions and picks
//      shortsCount moments (~shortsDurationSec each) most likely to perform
//      on TikTok/Reels/Shorts (laughs, hot takes, quotable lines).
//   2. For each pick, render a vertical 9:16 1080×1920 composition w/
//      burned-in captions via Remotion.
//   3. Upload each to Firebase Storage under episodes/{roomId}/shorts/.
import Anthropic from '@anthropic-ai/sdk';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { uploadEpisodeAsset } from '../storage.js';
import type { EditPlan, ParticipantTrack, ShowSettings, TranscriptSegment } from '../types.js';

interface ShortPick {
  startSec: number;
  endSec: number;
  hook: string; // 3-7 word title overlay
  reason: string; // why this clip — for logs
}

export async function generateShorts(
  roomId: string,
  tracks: ParticipantTrack[],
  plan: EditPlan,
  show: ShowSettings,
  workDir: string,
): Promise<string[]> {
  if (!config.anthropicApiKey) {
    console.warn('ANTHROPIC_API_KEY not set — skipping Shorts.');
    return [];
  }

  // 1. Ask Claude to pick clips.
  const picks = await pickClips(plan.transcript, show);

  // 2. Render each via Remotion vertical composition.
  const compositionRoot = resolve(fileURLToPath(import.meta.url), '../../remotion/index.ts');
  const serveUrl = await bundle({ entryPoint: compositionRoot, webpackOverride: (c) => c });

  const uploadedPaths: string[] = [];
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];

    const captions = plan.transcript
      .filter((s) => s.endSec > pick.startSec && s.startSec < pick.endSec)
      .map((s) => ({
        startSec: Math.max(0, s.startSec - pick.startSec),
        endSec: Math.min(pick.endSec - pick.startSec, s.endSec - pick.startSec),
        text: s.text,
        speaker: plan.guestNames[s.speaker] ?? s.speaker,
      }));

    const primaryTrack = mostActiveSpeakerTrack(pick, plan.transcript, tracks);

    const inputProps = {
      videoPath: primaryTrack.videoPath,
      offsetSec: pick.startSec,
      durationSec: pick.endSec - pick.startSec,
      hook: pick.hook,
      captions,
      brandColors: show.brandColors,
      logoUrl: show.logoUrl,
    };

    const composition = await selectComposition({ serveUrl, id: 'Short', inputProps });
    const outPath = join(workDir, `short-${String(i + 1).padStart(2, '0')}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outPath,
      inputProps,
      chromiumOptions: { gl: 'swiftshader' },
    });

    const upload = await uploadEpisodeAsset(roomId, `shorts/short-${String(i + 1).padStart(2, '0')}.mp4`, outPath);
    uploadedPaths.push(upload.path);
  }
  return uploadedPaths;
}

function mostActiveSpeakerTrack(
  pick: ShortPick,
  transcript: TranscriptSegment[],
  tracks: ParticipantTrack[],
): ParticipantTrack {
  const counts = new Map<string, number>();
  for (const s of transcript) {
    if (s.endSec < pick.startSec || s.startSec > pick.endSec) continue;
    counts.set(s.speaker, (counts.get(s.speaker) ?? 0) + (s.endSec - s.startSec));
  }
  let winner = tracks[0];
  let max = -1;
  for (const t of tracks) {
    const c = counts.get(t.identity) ?? 0;
    if (c > max) { max = c; winner = t; }
  }
  return winner;
}

async function pickClips(transcript: TranscriptSegment[], show: ShowSettings): Promise<ShortPick[]> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  // Compact transcript for the prompt — keep speaker + start + text.
  const lines = transcript.map((s) => `[${s.startSec.toFixed(1)}s | ${s.speaker}] ${s.text}`).join('\n');

  const sys = `You are a short-form video editor. You pick the most viral-worthy moments from a podcast transcript for TikTok / Instagram Reels / YouTube Shorts.

Selection criteria:
- Self-contained: the clip stands alone without needing setup.
- High-energy or quotable: laughs, hot takes, shocking facts, surprising stories.
- Avoid boring intros, sign-offs, or technical exchanges.
- Each clip ~${config.shortsDurationSec}s, with a strong opening hook in the first 2 seconds.

Return exactly ${config.shortsCount} picks as JSON array:
[
  { "startSec": number, "endSec": number, "hook": "3-7 word teaser overlay", "reason": "why this clip" }
]`;

  const usr = `Show context: ${show.showDescription ?? show.name}
Topic keywords: ${(show.topicKeywords ?? []).join(', ')}

Transcript:
${lines}

Pick the best ${config.shortsCount} short-form clips.`;

  const res = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: sys,
    messages: [{ role: 'user', content: usr }],
  });

  const text = res.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Find JSON array in the response.
  const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!jsonMatch) throw new Error('Claude did not return a JSON array of picks');
  const picks = JSON.parse(jsonMatch[0]) as ShortPick[];

  return picks
    .filter((p) => p.endSec > p.startSec && p.endSec - p.startSec >= 10 && p.endSec - p.startSec <= 90)
    .slice(0, config.shortsCount);
}
