import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

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

const SHOW_DOC = 'shows/main';

const DEFAULT_SETTINGS: ShowSettings = {
  name: 'Untitled Show',
  brandColors: {
    primary: '#ffffff',
    accent: '#aa3bff',
    background: '#0c0a13',
  },
};

export async function getShowSettings(): Promise<ShowSettings> {
  const snap = await getDoc(doc(db, SHOW_DOC));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as ShowSettings) };
}

export function watchShowSettings(cb: (s: ShowSettings) => void) {
  return onSnapshot(doc(db, SHOW_DOC), (snap) => {
    cb({ ...DEFAULT_SETTINGS, ...((snap.exists() ? snap.data() : {}) as ShowSettings) });
  });
}

export async function saveShowSettings(patch: Partial<ShowSettings>): Promise<void> {
  await setDoc(doc(db, SHOW_DOC), patch, { merge: true });
}

export async function uploadIntroVideo(file: File): Promise<{ path: string; url: string }> {
  const path = `show/intro.${file.name.split('.').pop() ?? 'mp4'}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);
  return { path, url };
}

export async function uploadLogo(file: File): Promise<{ path: string; url: string }> {
  const path = `show/logo.${file.name.split('.').pop() ?? 'png'}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);
  return { path, url };
}
