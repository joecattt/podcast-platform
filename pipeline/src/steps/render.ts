// Step: render the final video with Remotion.
//
// Strategy chosen for simplicity + reliability on Cloud Run:
//   The Remotion composition consumes the original per-guest video tracks
//   directly via <Video src=...> with offsetInFrames timing. The composition
//   reads the EditPlan + show settings and lays out grid / solo / cutaways +
//   lower-thirds + intro pre-roll.
//
// For v1 we render the composition headlessly via @remotion/renderer.
// Brand colors are passed in as input props.
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EditPlan, ParticipantTrack, ShowSettings } from '../types.js';

export async function renderFinalVideo(
  tracks: ParticipantTrack[],
  plan: EditPlan,
  show: ShowSettings,
  workDir: string,
): Promise<string> {
  const compositionRoot = resolve(fileURLToPath(import.meta.url), '../../remotion/index.ts');

  // Bundle the Remotion project once (cached in tmpdir).
  const serveUrl = await bundle({
    entryPoint: compositionRoot,
    webpackOverride: (cfg) => cfg,
  });

  const inputProps = {
    tracks: tracks.map((t) => ({
      identity: t.identity,
      displayName: t.displayName,
      videoPath: t.videoPath, // local fs path; Remotion loads via file:// URL
    })),
    plan,
    show: {
      name: show.name,
      logoUrl: show.logoUrl,
      introVideoUrl: show.introVideoUrl,
      brandColors: show.brandColors,
    },
  };

  const composition = await selectComposition({
    serveUrl,
    id: 'Episode',
    inputProps,
  });

  const outputPath = join(workDir, 'final.mp4');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    chromiumOptions: { gl: 'swiftshader' },
    concurrency: 2,
  });

  return outputPath;
}
