import { Composition } from 'remotion';
import { Episode, type EpisodeProps } from './Episode.js';
import { Short, type ShortProps } from './Short.js';

const FPS = 30;

const DEFAULT_EPISODE_PROPS: EpisodeProps = {
  tracks: [],
  plan: { durationSec: 60, cuts: [], multicam: [], transcript: [], guestNames: {} },
  show: {
    name: 'Show',
    brandColors: { primary: '#ffffff', accent: '#aa3bff', background: '#0c0a13' },
  },
};

const DEFAULT_SHORT_PROPS: ShortProps = {
  videoPath: '',
  offsetSec: 0,
  durationSec: 30,
  hook: '',
  captions: [],
  brandColors: { primary: '#ffffff', accent: '#aa3bff', background: '#0c0a13' },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Episode"
        component={Episode as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={FPS * 60}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={DEFAULT_EPISODE_PROPS as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => {
          const p = props as unknown as EpisodeProps;
          const cutTotal = p.plan.cuts.reduce((sum, c) => sum + (c.endSec - c.startSec), 0);
          const body = Math.max(0, p.plan.durationSec - cutTotal);
          const intro = p.show.introVideoUrl ? 5 : 0;
          return { durationInFrames: Math.ceil((intro + body) * FPS) };
        }}
      />
      <Composition
        id="Short"
        component={Short as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={FPS * 60}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_SHORT_PROPS as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => {
          const p = props as unknown as ShortProps;
          return { durationInFrames: Math.ceil(p.durationSec * FPS) };
        }}
      />
    </>
  );
};
