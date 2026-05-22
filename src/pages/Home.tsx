import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { createRoom } from '../lib/rooms';
import { Button } from '../components/Button';

export function Home() {
  const { user, signInAsGuest } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const u = user ?? (await signInAsGuest());
      const id = await createRoom(name.trim(), u.uid);
      navigate(`/room/${id}`);
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

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-6">
          <label className="block text-sm font-medium">Session name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ep. 42 — guest interview"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={busy || !name.trim()} className="w-full">
            {busy ? 'Creating…' : 'Create session'}
          </Button>
        </div>
      </div>
    </div>
  );
}
