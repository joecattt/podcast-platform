import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, isHost } from '../lib/auth';
import { createRoom } from '../lib/rooms';
import { Button } from '../components/Button';

export function Home() {
  const { user, signOut } = useAuth();
  const host = isHost(user);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !user) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await createRoom(name.trim(), user.uid);
      navigate(`/room/${id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Podcast Platform</h1>
          <p className="text-muted-foreground">Multi-guest recording. Local quality. No subscription.</p>
        </header>

        {host ? (
          <>
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-6">
              <label className="block text-sm font-medium">Session name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ep. 42 — guest interview"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button onClick={handleCreate} disabled={busy || !name.trim()} className="w-full">
                {busy ? 'Creating…' : 'Create session'}
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{user?.email}</span>
              <div className="flex gap-3">
                <Link to="/episodes" className="underline">Episodes</Link>
                <Link to="/settings" className="underline">Settings</Link>
                <button onClick={() => signOut()} className="underline">Sign out</button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Host sign-in required to create a session.</p>
            <Link to="/host" className="inline-block underline text-sm">
              Sign in as host →
            </Link>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Guests: you don't need to sign in. Open the session link your host sent you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
