import { ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Records a single MediaStream (local participant) to chunked blobs
 * and uploads each chunk to Firebase Storage as it's produced.
 * This is how Riverside-style "local recording" works: full-quality
 * capture on each guest's device, streamed to storage in pieces so a
 * dropped connection doesn't lose the whole take.
 */
export class ChunkedRecorder {
  private recorder: MediaRecorder | null = null;
  private chunkIndex = 0;
  private uploads: Promise<void>[] = [];
  private stream: MediaStream;
  private roomId: string;
  private identity: string;
  private mimeType: string;

  constructor(
    stream: MediaStream,
    roomId: string,
    identity: string,
    mimeType: string = 'video/webm;codecs=vp9,opus',
  ) {
    this.stream = stream;
    this.roomId = roomId;
    this.identity = identity;
    this.mimeType = mimeType;
  }

  start(chunkMs = 5000) {
    const mime = MediaRecorder.isTypeSupported(this.mimeType)
      ? this.mimeType
      : 'video/webm';

    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      const idx = this.chunkIndex++;
      const path = `recordings/${this.roomId}/${this.identity}/chunk-${String(idx).padStart(6, '0')}.webm`;
      this.uploads.push(uploadBytes(ref(storage, path), e.data).then(() => undefined));
    };
    this.recorder.start(chunkMs);
  }

  async stop(): Promise<void> {
    if (!this.recorder) return;
    await new Promise<void>((resolve) => {
      this.recorder!.onstop = () => resolve();
      this.recorder!.stop();
    });
    await Promise.all(this.uploads);
  }
}
