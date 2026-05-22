// HTTP entry — POST /process { roomId } triggers the full pipeline.
import express from 'express';
import { config } from './config.js';
import { auth } from './firebase.js';
import { processRoom } from './pipeline.js';
import { setError } from './episode.js';

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/process', async (req, res) => {
  // 1. Verify Firebase ID token + host email.
  const authHeader = req.header('Authorization') ?? '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return res.status(401).json({ error: 'missing bearer token' });

  let email: string | undefined;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    email = decoded.email?.toLowerCase();
  } catch {
    return res.status(401).json({ error: 'invalid firebase token' });
  }
  if (email !== config.hostEmail.toLowerCase()) {
    return res.status(403).json({ error: 'not authorized as host' });
  }

  // 2. Validate body.
  const roomId = String(req.body?.roomId ?? '');
  if (!roomId) return res.status(400).json({ error: 'roomId required' });

  // 3. Kick off pipeline async, return 202.
  res.status(202).json({ accepted: true, roomId });

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    try {
      await processRoom(roomId);
    } catch (e) {
      console.error('Pipeline failed for', roomId, e);
      await setError(roomId, e instanceof Error ? e.message : String(e));
    }
  })();
});

app.listen(config.port, () => {
  console.log(`Pipeline listening on :${config.port}`);
});
