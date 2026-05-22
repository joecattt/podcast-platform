#!/usr/bin/env bash
# Finishes Firebase + LiveKit + Cloudflare setup after you've done these
# three interactive steps in your terminal:
#
#   1. firebase login         (one-time browser OAuth)
#   2. wrangler login         (one-time browser OAuth)
#   3. sign up at cloud.livekit.io and grab API key/secret/WS URL
#
# Then run, with the three LiveKit values + a Firebase project ID:
#
#   FIREBASE_PROJECT_ID=podcast-platform-joecat \
#   LIVEKIT_API_KEY=APIxxx \
#   LIVEKIT_API_SECRET=secretxxx \
#   LIVEKIT_WS_URL=wss://xxx.livekit.cloud \
#   ./scripts/setup.sh

set -euo pipefail

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID (e.g. podcast-platform-joecat)}"
: "${LIVEKIT_API_KEY:?Set LIVEKIT_API_KEY from cloud.livekit.io}"
: "${LIVEKIT_API_SECRET:?Set LIVEKIT_API_SECRET from cloud.livekit.io}"
: "${LIVEKIT_WS_URL:?Set LIVEKIT_WS_URL (wss://xxx.livekit.cloud)}"

cd "$(dirname "$0")/.."

echo "==> Verifying firebase login"
firebase projects:list > /dev/null

echo "==> Verifying wrangler login"
wrangler whoami > /dev/null

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

echo "==> Creating Firebase web app"
firebase apps:create web "podcast-platform-web" --project "$FIREBASE_PROJECT_ID" 2>/dev/null || \
  echo "    (web app already exists — continuing)"
APP_ID=$(firebase apps:list web --project "$FIREBASE_PROJECT_ID" --json 2>/dev/null | \
  python3 -c "import json,sys;apps=json.load(sys.stdin).get('result',[]);print(apps[0]['appId'] if apps else '')")
if [ -z "$APP_ID" ]; then
  echo "Could not determine web app ID."
  exit 1
fi

echo "==> Deploying Cloudflare Worker"
cd worker
printf "%s" "$LIVEKIT_API_KEY"      | wrangler secret put LIVEKIT_API_KEY
printf "%s" "$LIVEKIT_API_SECRET"   | wrangler secret put LIVEKIT_API_SECRET
printf "%s" "$LIVEKIT_WS_URL"       | wrangler secret put LIVEKIT_WS_URL
printf "%s" "$FIREBASE_PROJECT_ID"  | wrangler secret put FIREBASE_PROJECT_ID
WORKER_URL=$(wrangler deploy 2>&1 | grep -oE 'https://[^[:space:]]+\.workers\.dev' | head -1)
cd ..
echo "    Worker deployed at: $WORKER_URL"

echo "==> Writing .env"
firebase apps:sdkconfig web "$APP_ID" --project "$FIREBASE_PROJECT_ID" --json > .firebase-sdkconfig.json
python3 <<PYEOF
import json, os
cfg = json.load(open('.firebase-sdkconfig.json'))['result']['sdkConfig']
with open('.env','w') as f:
    f.write(f"VITE_FIREBASE_API_KEY={cfg['apiKey']}\n")
    f.write(f"VITE_FIREBASE_AUTH_DOMAIN={cfg['authDomain']}\n")
    f.write(f"VITE_FIREBASE_PROJECT_ID={cfg['projectId']}\n")
    f.write(f"VITE_FIREBASE_STORAGE_BUCKET={cfg['storageBucket']}\n")
    f.write(f"VITE_FIREBASE_MESSAGING_SENDER_ID={cfg['messagingSenderId']}\n")
    f.write(f"VITE_FIREBASE_APP_ID={cfg['appId']}\n")
    f.write(f"VITE_LIVEKIT_WS_URL={os.environ['LIVEKIT_WS_URL']}\n")
    f.write(f"VITE_TOKEN_ENDPOINT=${WORKER_URL}\n")
PYEOF
rm .firebase-sdkconfig.json
echo "    wrote .env"

echo "==> Deploying Firestore + Storage rules"
firebase deploy --only firestore:rules,storage:rules --project "$FIREBASE_PROJECT_ID"

echo ""
echo "✅ Setup complete."
echo "   Worker:   $WORKER_URL"
echo "   Run:      npm run dev"
