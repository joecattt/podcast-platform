import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDownloadURL, listAll, ref } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface Track {
  identity: string;
  chunks: { name: string; url: string }[];
}

export function Downloads() {
  const { id } = useParams<{ id: string }>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const root = ref(storage, `recordings/${id}`);
      const folders = await listAll(root);
      const result: Track[] = [];
      for (const dir of folders.prefixes) {
        const files = await listAll(dir);
        const chunks = await Promise.all(
          files.items
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(async (item) => ({ name: item.name, url: await getDownloadURL(item) })),
        );
        result.push({ identity: dir.name, chunks });
      }
      setTracks(result);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading recordings…</div>;

  return (
    <div className="mx-auto max-w-3xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Recordings</h1>
        <p className="text-sm text-muted-foreground">
          Per-participant chunks. Concatenate WebM chunks in order to reassemble each track.
        </p>
      </header>
      {tracks.length === 0 && <p className="text-muted-foreground">No recordings yet.</p>}
      {tracks.map((t) => (
        <section key={t.identity} className="rounded-lg border border-border p-4">
          <h2 className="font-medium mb-2">{t.identity}</h2>
          <ul className="space-y-1 text-sm">
            {t.chunks.map((c) => (
              <li key={c.name}>
                <a className="text-primary underline" href={c.url} target="_blank" rel="noreferrer">
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
