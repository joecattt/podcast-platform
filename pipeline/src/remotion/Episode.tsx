import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig, staticFile, Img } from 'remotion';
import type { EditPlan } from '../types.js';

export interface EpisodeProps {
  tracks: { identity: string; displayName: string; videoPath: string }[];
  plan: EditPlan;
  show: {
    name: string;
    introVideoUrl?: string;
    logoUrl?: string;
    brandColors: { primary: string; accent: string; background: string };
  };
}

export const Episode: React.FC<EpisodeProps> = ({ tracks, plan, show }) => {
  const { fps } = useVideoConfig();
  const introSec = show.introVideoUrl ? 5 : 0; // overridden by intro video duration if known

  // Build the body timeline: skip cut ranges, render multicam segments.
  // Each segment maps source time -> output time.
  const bodySegments = computeBodyTimeline(plan);

  return (
    <AbsoluteFill style={{ backgroundColor: show.brandColors.background }}>
      {/* Intro */}
      {show.introVideoUrl && (
        <Sequence from={0} durationInFrames={Math.ceil(introSec * fps)}>
          <AbsoluteFill>
            <OffthreadVideo src={show.introVideoUrl} muted={false} />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* Body */}
      {bodySegments.map((seg, i) => {
        const startFrame = Math.floor((introSec + seg.outputStartSec) * fps);
        const durFrames = Math.max(1, Math.ceil((seg.outputEndSec - seg.outputStartSec) * fps));
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durFrames}>
            <MulticamView
              tracks={tracks}
              layout={seg.layout}
              primarySpeaker={seg.primarySpeaker}
              sourceStartSec={seg.sourceStartSec}
              brandColors={show.brandColors}
              guestNames={plan.guestNames}
            />
            {seg.layout === 'solo' && seg.primarySpeaker && (
              <LowerThird
                name={plan.guestNames[seg.primarySpeaker] ?? seg.primarySpeaker}
                color={show.brandColors.accent}
                logoUrl={show.logoUrl}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

interface BodySeg {
  outputStartSec: number;
  outputEndSec: number;
  sourceStartSec: number;
  layout: 'grid' | 'solo';
  primarySpeaker?: string;
}

// Combine multicam plan with cut plan to produce output-time segments.
function computeBodyTimeline(plan: EditPlan): BodySeg[] {
  const out: BodySeg[] = [];
  let outputCursor = 0;

  // Walk multicam segments in order, subtracting cut ranges that fall inside.
  for (const m of plan.multicam) {
    const visibleRanges = subtractCuts({ start: m.startSec, end: m.endSec }, plan.cuts);
    for (const r of visibleRanges) {
      const dur = r.end - r.start;
      if (dur < 0.05) continue;
      out.push({
        outputStartSec: outputCursor,
        outputEndSec: outputCursor + dur,
        sourceStartSec: r.start,
        layout: m.layout,
        primarySpeaker: m.primarySpeaker,
      });
      outputCursor += dur;
    }
  }
  return out;
}

function subtractCuts(range: { start: number; end: number }, cuts: { startSec: number; endSec: number }[]): { start: number; end: number }[] {
  let pieces = [range];
  for (const c of cuts) {
    const next: typeof pieces = [];
    for (const p of pieces) {
      if (c.endSec <= p.start || c.startSec >= p.end) {
        next.push(p);
        continue;
      }
      if (c.startSec > p.start) next.push({ start: p.start, end: c.startSec });
      if (c.endSec < p.end) next.push({ start: c.endSec, end: p.end });
    }
    pieces = next;
  }
  return pieces;
}

interface MulticamViewProps {
  tracks: EpisodeProps['tracks'];
  layout: 'grid' | 'solo';
  primarySpeaker?: string;
  sourceStartSec: number;
  brandColors: EpisodeProps['show']['brandColors'];
  guestNames: Record<string, string>;
}

const MulticamView: React.FC<MulticamViewProps> = ({ tracks, layout, primarySpeaker, sourceStartSec }) => {
  if (layout === 'solo' && primarySpeaker) {
    const t = tracks.find((x) => x.identity === primarySpeaker) ?? tracks[0];
    return (
      <AbsoluteFill>
        <OffthreadVideo
          src={fileUrl(t.videoPath)}
          startFrom={Math.floor(sourceStartSec * 30)}
          muted={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>
    );
  }

  // Grid layout — 1×N or 2×N depending on count.
  const cols = tracks.length <= 2 ? tracks.length : Math.ceil(Math.sqrt(tracks.length));
  const rows = Math.ceil(tracks.length / cols);
  return (
    <AbsoluteFill style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 4 }}>
      {tracks.map((t) => (
        <div key={t.identity} style={{ overflow: 'hidden', position: 'relative' }}>
          <OffthreadVideo
            src={fileUrl(t.videoPath)}
            startFrom={Math.floor(sourceStartSec * 30)}
            muted={t.identity !== primarySpeaker}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ))}
    </AbsoluteFill>
  );
};

const LowerThird: React.FC<{ name: string; color: string; logoUrl?: string }> = ({ name, color, logoUrl }) => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', pointerEvents: 'none' }}>
    <div
      style={{
        margin: '0 0 80px 80px',
        padding: '14px 22px',
        borderLeft: `6px solid ${color}`,
        background: 'rgba(0,0,0,0.55)',
        color: 'white',
        fontFamily: 'sans-serif',
        fontWeight: 600,
        fontSize: 36,
        alignSelf: 'flex-start',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}
    >
      {logoUrl && <Img src={logoUrl} style={{ height: 36, width: 'auto' }} />}
      {name}
    </div>
  </AbsoluteFill>
);

function fileUrl(p: string): string {
  // Remotion needs file:// for local paths or https:// for remote.
  if (p.startsWith('http')) return p;
  return `file://${p}`;
}

// Keep unused import warnings away — staticFile may be used in future.
void staticFile;
