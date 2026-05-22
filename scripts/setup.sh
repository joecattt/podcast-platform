#!/usr/bin/env bash
# Finishes Firebase + LiveKit setup after you've done the two interactive steps:
#   1. firebase login              (one-time, in your terminal)
#   2. signup at cloud.livekit.io  (then export the 3 vars below)
#
# Usage:
#   FIREBASE_PROJECT_ID=podcast-platform-xxx \
#   LIVEKIT_API_KEY=APIxxx \
#   LIVEKIT_API_SECRET=secretxxx \
#   LIVEKIT_WS_URL=wss://xxx.livekit.cloud \
#   ./scripts/setup.sh

set -euo pipefail

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID (e.g. podcast-platform-7e3a)}"
: "${LIVEKIT_API_KEY:?Set LIVEKIT_API_KEY from cloud.livekit.io}"
: "${LIVEKIT_API_SECRET:?Set LIVEKIT_API_SECRET from cloud.livekit.io}"
: "${LIVEKIT_WS_URL:?Set LIVEKIT_WS_URL (wss://xxx.livekit.cloud)}"

cd "$(dirname "$0")/.."

echo "==> Verifying firebase login"
firebase projects:list > /dev/null

echo "==> Creating Firebase project (will skip if it already exists)"
firebase projects:create "$FIREBASE_PROJECT_ID" --display-name "Podcast Platform" 2>/dev/null || \
  echo "    (project already exists or name taken — continuing)"

echo "==> Pinning project in .firebaserc"
cat > .firebaserc <<EOF
{
  "projects": {
    "default": "$FIREBASE_PROJECT_ID"
  }
}
EOF

echo "==> Creating web app + writing .env"
APP_OUTPUT=$(firebase apps:create web "podcast-platform-web" --project "$FIREBASE_PROJECT_ID" 2>&1 || true)
APP_ID=$(firebase apps:list web --project "$FIREBASE_PROJECT_ID" --json 2>/dev/null | python3 -c "import json,sys;apps=json.load(sys.stdin).get('result',[]);print(apps[0]['appId'] if apps else '')")
if [ -z "$APP_ID" ]; then
  echo "Could not determine web app ID. Run 'firebase apps:list web' manually."
  exit 1
fi
firebase apps:sdkconfig web "$APP_ID" --project "$FIREBASE_PROJECT_ID" --json > .firebase-sdkconfig.json
python3 <<PYEOF
import json
cfg = json.load(open('.firebase-sdkconfig.json'))['result']['sdkConfig']
with open('.env','w') as f:
    f.write(f"VITE_FIREBASE_API_KEY={cfg['apiKey']}\n")
    f.write(f"VITE_FIREBASE_AUTH_DOMAIN={cfg['authDomain']}\n")
    f.write(f"VITE_FIREBASE_PROJECT_ID={cfg['projectId']}\n")
    f.write(f"VITE_FIREBASE_STORAGE_BUCKET={cfg['storageBucket']}\n")
    f.write(f"VITE_FIREBASE_MESSAGING_SENDER_ID={cfg['messagingSenderId']}\n")
    f.write(f"VITE_FIREBASE_APP_ID={cfg['appId']}\n")
    f.write(f"VITE_LIVEKIT_WS_URL=$LIVEKIT_WS_URL\n")
PYEOF
rm .firebase-sdkconfig.json
echo "    wrote .env"

echo "==> Setting Firebase Function secrets"
printf "%s" "$LIVEKIT_API_KEY"    | firebase functions:secrets:set LIVEKIT_API_KEY    --project "$FIREBASE_PROJECT_ID" --data-file=-
printf "%s" "$LIVEKIT_API_SECRET" | firebase functions:secrets:set LIVEKIT_API_SECRET --project "$FIREBASE_PROJECT_ID" --data-file=-
printf "%s" "$LIVEKIT_WS_URL"     | firebase functions:secrets:set LIVEKIT_WS_URL     --project "$FIREBASE_PROJECT_ID" --data-file=-

echo "==> Deploying rules + functions"
firebase deploy --only firestore:rules,storage:rules,functions --project "$FIREBASE_PROJECT_ID"

echo ""
echo "✅ Setup complete."
echo "Run:  npm run dev"
