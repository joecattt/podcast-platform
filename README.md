# Podcast Platform

Self-hosted Riverside alternative. Multi-guest browser-based recording with **local-quality per-track capture** — each guest's audio/video is recorded on their device at full quality and uploaded in chunks while the call runs, so a dropped connection doesn't lose the take.

## Stack (all free tier, no credit card)

- **React + Vite + TypeScript + Tailwind** (frontend)
- **LiveKit Cloud free tier** — WebRTC SFU, free up to 50 participants / 100 concurrent
- **Firebase Spark plan** — Auth (anonymous), Firestore (rooms + recording state), Storage (raw track chunks). No card required.
- **Cloudflare Workers** — mints LiveKit access tokens. 100K req/day free, no card required.

## Setup

You need accounts at three places (all free, no card):

### 1. Firebase
1. Run `firebase login` in your terminal (one-time browser OAuth).
2. Pick a globally-unique project ID, e.g. `podcast-platform-joecat`.

### 2. Cloudflare
1. Run `wrangler login` in your terminal (one-time browser OAuth).

### 3. LiveKit Cloud
1. Sign up at https://cloud.livekit.io
2. Create a project. Note these three values:
   - API Key (starts with `API…`)
   - API Secret
   - WebSocket URL (`wss://yourproject-xxxx.livekit.cloud`)

### 4. Run setup
```bash
FIREBASE_PROJECT_ID=podcast-platform-joecat \
LIVEKIT_API_KEY=APIxxxxx \
LIVEKIT_API_SECRET=secretxxx \
LIVEKIT_WS_URL=wss://xxx.livekit.cloud \
./scripts/setup.sh
```

This creates the Firebase project + web app, deploys the Cloudflare Worker with secrets, writes your `.env`, and deploys Firestore + Storage security rules.

### 5. Dev
```bash
npm run dev
```

## How it works

- **Create session** (Home) → writes a doc to Firestore `rooms/{id}`, you become the host.
- **Join session** (`/room/:id`) → frontend signs in to Firebase anonymously, gets a Firebase ID token, POSTs it to the Cloudflare Worker, which verifies the ID token and mints a LiveKit JWT.
- **Host clicks "Start session recording"** → flips `rooms/{id}.recording = true` in Firestore. Every connected client watches that doc and starts its own `MediaRecorder` on its local camera+mic stream.
- **While recording** → each client uploads 5-second WebM chunks to `recordings/{roomId}/{uid}/chunk-NNNNNN.webm` in Firebase Storage. If a guest drops, their already-uploaded chunks are safe.
- **Stop recording** → host flips the flag back; clients finalize and finish uploads.
- **Downloads** (`/room/:id/downloads`) → per-participant track list. Concatenate WebM chunks in order to reassemble each guest's full-quality take.

## What's not built yet

- Server-side stitching of chunks → single file per guest (could be another Worker or a Firebase Function with `ffmpeg`)
- Waiting room / host approval
- Mute / kick controls
- Mixed-down composite recording (for quick share)
- Custom branding / show artwork
- Episode list / show feed
