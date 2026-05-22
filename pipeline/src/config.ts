// Pipeline configuration — read from env vars set in Cloud Run.

export const config = {
  port: Number(process.env.PORT ?? 8080),
  firebaseProjectId: req('FIREBASE_PROJECT_ID'),
  storageBucket: req('FIREBASE_STORAGE_BUCKET'),

  // Auth for /process endpoint — verifies Firebase ID token's email.
  hostEmail: process.env.HOST_EMAIL ?? 'whitehat@joecattt.com',

  // External AI services
  anthropicApiKey: process.env.ANTHROPIC_API_KEY, // for SEO + Shorts moment selection

  // Local tooling paths (baked into Docker image)
  whisperBin: process.env.WHISPER_BIN ?? '/opt/whisper.cpp/build/bin/whisper-cli',
  whisperModel: process.env.WHISPER_MODEL ?? '/opt/whisper.cpp/models/ggml-small.en-q5_1.bin',

  // Editorial defaults
  silenceThresholdSec: Number(process.env.SILENCE_THRESHOLD_SEC ?? 2.5),
  reactionRmsDb: Number(process.env.REACTION_RMS_DB ?? -28), // audio level above which a "silent" gap is preserved as reaction
  shortsCount: Number(process.env.SHORTS_COUNT ?? 4),
  shortsDurationSec: Number(process.env.SHORTS_DURATION_SEC ?? 45),
};

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
