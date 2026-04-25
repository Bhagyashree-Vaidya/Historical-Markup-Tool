#!/usr/bin/env bash
# deploy.sh — build, push, and deploy the Historical Markup Tool to Cloud Run
# Usage: bash deploy.sh
set -euo pipefail

PROJECT_ID="historical-markup-tool-v2"
REGION="us-central1"
SERVICE="historical-markup-tool"
REPO="hmt-repo"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:latest"

echo "══════════════════════════════════════════════"
echo "  Historical Markup Tool — Cloud Run Deploy"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Image   : $IMAGE"
echo "══════════════════════════════════════════════"

# ── 1. Ensure gcloud is pointing at the right project ──────────────────────
gcloud config set project "$PROJECT_ID"

# ── 2. Create Artifact Registry repo (safe to run if it already exists) ────
echo ""
echo "▸ Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Historical Markup Tool images" \
  --project="$PROJECT_ID" 2>/dev/null \
  && echo "  Created repo: $REPO" \
  || echo "  Repo already exists — continuing."

# ── 3. Grant the default Compute SA the Vertex AI User role ────────────────
echo ""
echo "▸ Granting Vertex AI User role to Cloud Run service account..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user" \
  --quiet

# ── 4. Enable Cloud Build API ──────────────────────────────────────────────
gcloud services enable cloudbuild.googleapis.com --project="$PROJECT_ID" --quiet

# ── 5. Build + push via Cloud Build (no local Docker needed) ───────────────
echo ""
echo "▸ Building image with Cloud Build (no local Docker needed)..."
gcloud builds submit \
  --tag "$IMAGE" \
  --project="$PROJECT_ID" \
  .

# ── 7. Deploy to Cloud Run ─────────────────────────────────────────────────
echo ""
echo "▸ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --platform=managed \
  --region="$REGION" \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --set-env-vars="GCP_PROJECT=$PROJECT_ID,GCP_LOCATION=$REGION" \
  --project="$PROJECT_ID"

# ── 8. Print the live URL ───────────────────────────────────────────────────
echo ""
URL=$(gcloud run services describe "$SERVICE" \
  --platform=managed \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")
echo "══════════════════════════════════════════════"
echo "  ✓ Deployed! Your tool is live at:"
echo "  $URL"
echo "══════════════════════════════════════════════"
