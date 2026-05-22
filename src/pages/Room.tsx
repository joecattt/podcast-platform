import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
  ControlBar,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { useAuth } from '../lib/auth';
import { fetchLiveKitToken, LIVEKIT_WS_URL } from '../lib/livekit';
import { getRoom, setRecording, watchRoom, type Room as RoomDoc } from '../lib/rooms';
import { ChunkedRecorder } from '../lib/recording';
import { createEpisodeForRoom } from '../lib/episodes';
import { triggerPipeline } from '../lib/pipeline';
import { Button } from '../components/Button';
import { useParticipants } from '@livekit/components-react';

export function Room() {
  const { id } = useParams<{ id: string }>();
  const { user, signInAsGuest } = useAuth();
  const [room, setRoomDoc] = useState<RoomDoc | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRoom(id).then(setRoomDoc);
  }, [id]);

  async function handleJoin() {
    if (!id || !displayName.trim()) return;
    const u = user ?? (await signInAsGuest());
    const { token } = await fetchLiveKitToken(id, u.uid, displayName.trim());
    setToken(token);
    setJoined(true);
  }

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading session…</div>;
  }

  if (!joined || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <div>
            <p className="text-sm text-muted-foreground">Joining</p>
            <h1 className="text-2xl font-semibold">{room.name}</h1>
          </div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <Button onClick={handleJoin} disabled={!displayName.trim()} className="w-full">
            Join session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LIVEKIT_WS_URL}
      connect
      audio
      video
      data-lk-theme="default"
      className="min-h-screen flex flex-col"
    >
      <RoomAudioRenderer />
      <RoomInner room={room} isHost={room.hostUid === user?.uid} />
    </LiveKitRoom>
  );
}

function RoomInner({ room, isHost }: { room: RoomDoc; isHost: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const recorderRef = useRef<ChunkedRecorder | null>(null);
  const [recording, setRecordingState] = useState(false);
  const [hostRecording, setHostRecording] = useState(false);

  // Watch room doc — when host flips `recording`, every participant
  // starts/stops their own local ChunkedRecorder.
  useEffect(() => {
    return watchRoom(room.id, (r) => {
      if (!r) return;
      setHostRecording(r.recording);
    });
  }, [room.id]);

  useEffect(() => {
    if (hostRecording && !recorderRef.current) {
      startLocalRecording();
    } else if (!hostRecording && recorderRef.current) {
      stopLocalRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostRecording]);

  async function startLocalRecording() {
    const camTrack = localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
    const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    if (!camTrack && !micTrack) return;
    const stream = new MediaStream();
    if (camTrack) stream.addTrack(camTrack);
    if (micTrack) stream.addTrack(micTrack);
    const rec = new ChunkedRecorder(stream, room.id, localParticipant.identity);
    rec.start();
    recorderRef.current = rec;
    setRecordingState(true);
  }

  async function stopLocalRecording() {
    await recorderRef.current?.stop();
    recorderRef.current = null;
    setRecordingState(false);
  }

  async function toggleHostRecording() {
    if (!isHost) return;
    const next = !hostRecording;

    if (next) {
      // Starting — create the episode doc so the dashboard reflects it.
      const guestNames = participants.map((p) => p.name || p.identity);
      try {
        await createEpisodeForRoom(room.id, room.name, guestNames);
      } catch (e) {
        console.warn('createEpisode failed', e);
      }
      await setRecording(room.id, true);
    } else {
      // Stopping — flip flag (clients finalize uploads), then trigger pipeline.
      await setRecording(room.id, false);
      try {
        await triggerPipeline(room.id);
      } catch (e) {
        console.warn('Pipeline trigger failed (will need manual retry):', e);
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold">{room.name}</h1>
          <p className="text-xs text-muted-foreground">{isHost ? 'Host' : 'Guest'}</p>
        </div>
        <div className="flex items-center gap-3">
          {recording && (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              REC (your track)
            </span>
          )}
          {isHost ? (
            hostRecording ? (
              <Button variant="destructive" onClick={toggleHostRecording}>
                ■ Stop session recording
              </Button>
            ) : (
              <Button onClick={toggleHostRecording}>● Start session recording</Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">
              {hostRecording ? 'Host is recording' : 'Waiting for host to start'}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 p-4">
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      </div>

      <ControlBar variation="minimal" controls={{ microphone: true, camera: true, screenShare: true, leave: true }} />
    </div>
  );
}
