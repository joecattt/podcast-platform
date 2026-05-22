# Pipeline (Cloud Run)

Post-production service. Triggered when the host stops recording. Reads
raw chunks from Firebase Storage and writes the finished episode back.

## Steps

1. **Download chunks** per participant from `recordings/{roomId}/{identity}/`
2. **Stitch + audio cleanup** — ffmpeg concat → h264 mp4. Audio chain: highpass 70Hz, FFT denoise, de-esser, presence-lift EQ, LUFS loudnorm (-16 LUFS target).
3. **Transcribe** each track separately via `whisper.cpp` (small.en-q5_1). One transcript per speaker — no diarization needed because tracks are pre-separated.
4. **Edit plan** — find ≥2.5s silences, but preserve gaps with reaction-level audio (laughs). Build multicam timeline (2 guests → grid; 3+ → active speaker w/ reactor cutaways).
5. **Render** final via Remotion: intro pre-roll → body w/ multicam + lower-thirds + brand color overlays.
6. **AI Shorts** — Claude picks N best moments, Remotion renders vertical 9:16 with burned captions.
7. **SEO metadata** — Claude writes title, description with auto-chapters, hashtags, YouTube tags.
8. **Upload** all outputs to `episodes/{roomId}/` in Firebase Storage. (YouTube auto-upload is stubbed for v1 — you download from the dashboard and upload manually.)

## Deploy

```bash
# One-time gcloud setup:
gcloud auth login
gcloud config set project YOUR_FIREBASE_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Deploy:
FIREBASE_PROJECT_ID=podcast-platform-joecat \
FIREBASE_STORAGE_BUCKET=podcast-platform-joecat.appspot.com \
ANTHROPIC_API_KEY=sk-ant-... \
./scripts/deploy.sh
```

The output URL is what `VITE_PIPELINE_ENDPOINT` should point to in the frontend `.env`.

## Local dev

```bash
# Requires: ffmpeg, ffprobe, chromium, whisper.cpp built locally,
#   GOOGLE_APPLICATION_CREDENTIALS pointed at a Firebase service-account JSON.
FIREBASE_PROJECT_ID=... \
FIREBASE_STORAGE_BUCKET=... \
WHISPER_BIN=/path/to/whisper-cli \
WHISPER_MODEL=/path/to/ggml-small.en-q5_1.bin \
ANTHROPIC_API_KEY=sk-ant-... \
npm run dev
```

## Cost

Cloud Run free tier: 2M req/mo, 360K vCPU-seconds, 180K GiB-seconds memory. A
single 45-minute episode running this pipeline takes roughly 15-25 min of
4 vCPU / 4 GiB memory, which is well inside the free tier even at weekly cadence.

Anthropic API: SEO + Shorts picking use Claude Opus 4.5. Each episode is roughly
~30k input tokens (transcript) and ~2k output. At current pricing that's ~$0.50 per
episode. The pipeline still works without `ANTHROPIC_API_KEY` set (placeholder
SEO; no Shorts).
