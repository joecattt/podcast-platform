# Podcast Platform

Self-hosted Riverside alternative. Multi-guest browser-based recording with **local-quality per-track capture** — each guest's audio/video is recorded on their device at full quality and uploaded in chunks while the call runs, so a dropped connection doesn't lose the take.

## Stack

- **React + Vite + TypeScript + Tailwind** (frontend)
- **LiveKit Cloud free tier** (WebRTC SFU — multi-guest call layer)
- **Firebase** — Auth (anonymous), Firestore (rooms + recording state), Storage (raw track chunks), Functions (LiveKit token minting)

## Setup

### 1. Firebase project
```bash
# Create a project at https://console.firebase.google.com
# Enable: Authentication (Anonymous), Firestore, Storage, Functions (Blaze plan required for Functions)
```
Put your project ID in `.firebaserc` and your web-app config in `.env` (copy from `.env.example`).

### 2. LiveKit Cloud
1. Create a project at https://cloud.livekit.io
2. Copy the API Key, API Secret, and WS URL
3. Store the secrets in Firebase:
```bash
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET
firebase functions:secrets:set LIVEKIT_WS_URL
```
4. Add the WS URL to `.env`:
```
VITE_LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

### 3. Install & run
```bash
npm install
cd functions && npm install && cd ..

# Deploy backend
firebase deploy --only functions,firestore:rules,storage:rules

# Dev frontend
npm run dev
```

## How it works

- **Create session** (Home) → writes a doc to Firestore `rooms/{id}`, you become the host.
- **Join session** (`/room/:id`) → Firebase Function mints a LiveKit JWT, you connect to the SFU.
- **Host clicks "Start session recording"** → flips `rooms/{id}.recording = true`. Every connected client watches that doc and starts its own `MediaRecorder` against its local camera+mic stream.
- **While recording** → each client uploads 5-second WebM chunks to `recordings/{roomId}/{uid}/chunk-NNNNNN.webm` in Firebase Storage.
- **Stop recording** → host flips the flag back; clients finalize and finish uploads.
- **Downloads** (`/room/:id/downloads`) → per-participant track list. Concatenate chunks in order to reassemble each guest's full-quality take.

## What's not built yet

- Server-side stitching of chunks → single file per guest (could be a Function with `ffmpeg`)
- Waiting room / host approval
- Mute / kick controls
- Mixed-down composite recording (for quick share)
- Custom branding / show artwork
- Episode list / show feed
