import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { isHost, useAuth } from '../lib/auth';
import { watchEpisodes, type Episode, type EpisodeStatus } from '../lib/episodes';

const STATUS_LABEL: Record<EpisodeStatus, string> = {
  recording: 'Recording',
  queued: 'Queued',
  stitching: 'Stitching tracks',
  transcribing: 'Transcribing',
  editing: 'Editing (cuts + multicam)',
  rendering: 'Rendering final',
  shorts: 'Generating Shorts',
  uploaded: 'Ready',
  failed: 'Failed',
};

const STATUS_COLOR: Record<EpisodeStatus, string> = {
  recording: 'bg-red-500/15 text-red-400',
  queued: 'bg-muted text-muted-foreground',
  stitching: 'bg-blue-500/15 text-blue-400',
  transcribing: 'bg-blue-500/15 text-blue-400',
  editing: 'bg-blue-500/15 text-blue-400',
  rendering: 'bg-blue-500/15 text-blue-400',
  shorts: 'bg-blue-500/15 text-blue-400',
  uploaded: 'bg-green-500/15 text-green-400',
  failed: 'bg-destructive/15 text-destructive',
};

export function Episodes() {
  const { user, loading } = useAuth();
  const [eps, setEps] = useState<Episode[] | null>(null);

  useEffect(() => watchEpisodes(setEps), []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!isHost(user)) return <Navigate to="/host" state={{ next: '/episodes' }} replace />;

  return (
    <div className="mx-auto max-w-4xl p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Episodes</h1>
        <Link to="/" className="text-sm underline text-muted-foreground">← Home</Link>
      </header>

      {eps === null && <p className="text-muted-foreground">Loading episodes…</p>}
      {eps?.length === 0 && <p className="text-muted-foreground">No episodes yet. Create a session from Home.</p>}

      <div className="space-y-3">
        {eps?.map((e) => (
          <div key={e.id} className="rounded-lg border border-border p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="font-medium truncate">{e.seoTitle ?? e.title}</h2>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[e.status]}`}>
                  {STATUS_LABEL[e.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {e.guestCount} guest{e.guestCount === 1 ? '' : 's'}
                {e.guestNames && ` · ${e.guestNames.join(', ')}`}
                {e.durationSec ? ` · ${Math.round(e.durationSec / 60)}m` : ''}
                {' · '}{e.createdAt.toDate().toLocaleString()}
              </p>
              {e.errorMessage && <p className="text-xs text-destructive mt-1">{e.errorMessage}</p>}
              {e.status === 'uploaded' && (
                <div className="flex gap-3 text-sm mt-2">
                  {e.finalVideoUrl && (
                    <a href={e.finalVideoUrl} target="_blank" rel="noreferrer" className="underline">
                      Download final MP4
                    </a>
                  )}
                  {(e.shortsPaths?.length ?? 0) > 0 && (
                    <span className="text-muted-foreground">{e.shortsPaths!.length} Shorts ready</span>
                  )}
                </div>
              )}
            </div>
            <Link to={`/room/${e.roomId}`} className="text-xs underline shrink-0">Room</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
