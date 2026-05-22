import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig, Img } from 'remotion';

interface Caption {
  startSec: number;
  endSec: number;
  text: string;
  speaker: string;
}

export interface ShortProps {
  videoPath: string;
  offsetSec: number;
  durationSec: number;
  hook: string;
  captions: Caption[];
  brandColors: { primary: string; accent: string; background: string };
  logoUrl?: string;
}

export const Short: React.FC<ShortProps> = ({ videoPath, offsetSec, hook, captions, brandColors, logoUrl }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const tSec = frame / fps;

  // Active caption at current time.
  const active = captions.find((c) => tSec >= c.startSec && tSec < c.endSec);

  return (
    <AbsoluteFill style={{ backgroundColor: brandColors.background }}>
      {/* Speaker video, cover-cropped to 9:16. */}
      <OffthreadVideo
        src={fileUrl(videoPath)}
        startFrom={Math.floor(offsetSec * fps)}
        muted={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Hook overlay — top center, sticks for first 4s. */}
      {hook && tSec < 4 && (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', pointerEvents: 'none' }}>
          <div
            style={{
              marginTop: 120,
              padding: '18px 28px',
              background: brandColors.accent,
              color: 'white',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 800,
              fontSize: 62,
              textAlign: 'center',
              maxWidth: 880,
              borderRadius: 16,
              boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
            }}
          >
            {hook.toUpperCase()}
          </div>
        </AbsoluteFill>
      )}

      {/* Burned-in captions — bottom third. */}
      {active && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none' }}>
          <div
            style={{
              marginBottom: 240,
              padding: '20px 28px',
              background: 'rgba(0,0,0,0.78)',
              color: 'white',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 56,
              textAlign: 'center',
              maxWidth: 920,
              lineHeight: 1.15,
              borderRadius: 12,
            }}
          >
            {active.text}
          </div>
        </AbsoluteFill>
      )}

      {/* Logo bug bottom right */}
      {logoUrl && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', pointerEvents: 'none' }}>
          <Img src={logoUrl} style={{ height: 90, width: 'auto', margin: 40, opacity: 0.85 }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

function fileUrl(p: string): string {
  if (p.startsWith('http')) return p;
  return `file://${p}`;
}
