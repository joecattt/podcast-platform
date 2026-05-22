import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Room {
  id: string;
  name: string;
  hostUid: string;
  createdAt: unknown;
  recording: boolean;
  recordingStartedAt?: unknown;
}

export async function createRoom(name: string, hostUid: string): Promise<string> {
  const ref = await addDoc(collection(db, 'rooms'), {
    name,
    hostUid,
    createdAt: serverTimestamp(),
    recording: false,
  });
  return ref.id;
}

export async function getRoom(id: string): Promise<Room | null> {
  const snap = await getDoc(doc(db, 'rooms', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Room, 'id'>) };
}

export function watchRoom(roomId: string, cb: (room: Room | null) => void) {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...(snap.data() as Omit<Room, 'id'>) });
  });
}

export async function setRecording(roomId: string, recording: boolean) {
  await updateDoc(doc(db, 'rooms', roomId), {
    recording,
    ...(recording ? { recordingStartedAt: serverTimestamp() } : {}),
  });
}
