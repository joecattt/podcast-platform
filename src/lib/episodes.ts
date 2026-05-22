import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

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
  id: string;
  roomId: string;
  title: string;
  status: EpisodeStatus;
  guestCount: number;
  guestNames?: string[];
  durationSec?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  errorMessage?: string;

  // Outputs (populated as pipeline progresses)
  finalVideoPath?: string;
  finalVideoUrl?: string;
  transcriptPath?: string;
  shortsPaths?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoTags?: string[];
}

export function watchEpisodes(cb: (eps: Episode[]) => void) {
  const q = query(collection(db, 'episodes'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Episode, 'id'>) })));
  });
}

export async function createEpisodeForRoom(roomId: string, title: string, guestNames: string[]): Promise<void> {
  const now = Timestamp.now();
  await setDoc(doc(db, 'episodes', roomId), {
    roomId,
    title,
    status: 'recording' satisfies EpisodeStatus,
    guestCount: guestNames.length,
    guestNames,
    createdAt: now,
    updatedAt: now,
  });
}
