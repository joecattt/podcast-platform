#!/usr/bin/env bash
# Builds the pipeline image and deploys it to Cloud Run with the required secrets.
#
# Prereqs:
#   gcloud auth login
#   gcloud config set project $FIREBASE_PROJECT_ID
#   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
#
# Required env:
#   FIREBASE_PROJECT_ID
#   FIREBASE_STORAGE_BUCKET   (e.g. <project>.appspot.com  OR  <project>.firebasestorage.app)
#   ANTHROPIC_API_KEY         (for SEO + Shorts moment selection; optional but recommended)

set -euo pipefail

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID}"
: "${FIREBASE_STORAGE_BUCKET:?Set FIREBASE_STORAGE_BUCKET}"

cd "$(dirname "$0")/.."

REGION="${REGION:-us-central1}"
SERVICE="podcast-platform-pipeline"

echo "==> Building + pushing image via Cloud Build"
gcloud builds submit --tag "gcr.io/$FIREBASE_PROJECT_ID/$SERVICE:latest"

echo "==> Deploying Cloud Run service"
EXTRA_ARGS=()
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  EXTRA_ARGS+=(--set-env-vars "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
fi

gcloud run deploy "$SERVICE" \
  --image "gcr.io/$FIREBASE_PROJECT_ID/$SERVICE:latest" \
  --region "$REGION" \
  --platform managed \
  --memory 4Gi \
  --cpu 4 \
  --timeout 3600 \
  --max-instances 3 \
  --concurrency 1 \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET" \
  "${EXTRA_ARGS[@]}"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
echo ""
echo "✅ Pipeline deployed at: $URL"
echo "   Add to web/.env:   VITE_PIPELINE_ENDPOINT=$URL"
