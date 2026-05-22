// Shared types — mirror the frontend's episode/show models on the server side.

export type EpisodeStatus =
  | 'recording'
  | 'queued'
  | 'stitching'
  | 'transcribing'
  | 'editing'
  | 'rendering'
  | 'shorts'
  | 'uploaded'
  | 'failed';

export interface Episode {
  roomId: string;
  title: string;
  status: EpisodeStatus;
  guestCount: number;
  guestNames?: string[];
  durationSec?: number;
  errorMessage?: string;
  finalVideoPath?: string;
  finalVideoUrl?: string;
  transcriptPath?: string;
  shortsPaths?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoTags?: string[];
}

export interface ShowSettings {
  name: string;
  introVideoPath?: string;
  introVideoUrl?: string;
  logoPath?: string;
  logoUrl?: string;
  brandColors: {
    primary: string;
    accent: string;
    background: string;
  };
  showDescription?: string;
  topicKeywords?: string[];
}

// Per-participant track after stitching.
export interface ParticipantTrack {
  identity: string;
  displayName: string;
  videoPath: string; // local fs path
  audioPath: string;
}

// One whisper segment — speech window with words.
export interface TranscriptSegment {
  speaker: string; // identity
  startSec: number;
  endSec: number;
  text: string;
}

// Multicam plan: a timeline of which speaker is the active "camera" for the edit.
export interface MulticamSegment {
  startSec: number;
  endSec: number;
  // For 2-guest, layout='grid'. For 3+, layout='solo' and primary is the active speaker
  // OR a tagged reactor for a brief cutaway.
  layout: 'grid' | 'solo';
  primarySpeaker?: string; // identity (when layout='solo')
  reactionCutaway?: boolean; // brief cut to a non-speaker who reacted (laugh, etc.)
}

// Cut plan: ranges to REMOVE from the timeline (silences ≥ threshold).
export interface CutRange {
  startSec: number;
  endSec: number;
}

// Output of the editorial step — what the renderer consumes.
export interface EditPlan {
  durationSec: number;
  cuts: CutRange[];
  multicam: MulticamSegment[];
  transcript: TranscriptSegment[];
  guestNames: Record<string, string>; // identity -> displayName
}
