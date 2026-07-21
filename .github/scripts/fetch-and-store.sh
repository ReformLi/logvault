#!/bin/bash
set -euo pipefail

# Required env: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_OWNER_ID, APP_URL, CRON_SECRET

echo "=== Step 1: Get latest deployment ==="
DEPLOYMENT=$(curl -s --fail \
  "https://api.vercel.com/v6/deployments?limit=1&state=READY&target=production&projectId=${VERCEL_PROJECT_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}")

DEPLOYMENT_ID=$(echo "$DEPLOYMENT" | jq -r '.deployments[0].uid // empty')
if [ -z "$DEPLOYMENT_ID" ]; then
  echo "No deployment found"
  exit 0
fi
echo "Deployment: $DEPLOYMENT_ID"

echo "=== Step 2: Fetch request logs from Vercel API ==="
RESPONSE=$(curl -s --fail \
  "https://vercel.com/api/logs/request-logs?projectId=${VERCEL_PROJECT_ID}&ownerId=${VERCEL_OWNER_ID}&deploymentId=${DEPLOYMENT_ID}&environment=production&limit=200" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}")

ROW_COUNT=$(echo "$RESPONSE" | jq '.rows | length')
echo "Rows fetched: $ROW_COUNT"

if [ "$ROW_COUNT" -eq "0" ]; then
  echo "No logs to store"
  exit 0
fi

echo "=== Step 3: POST to app store endpoint ==="
BODY=$(echo "$RESPONSE" | jq --arg id "$DEPLOYMENT_ID" '{deploymentId: $id, rows: .rows}')
RESULT=$(curl -s --fail -X POST "${APP_URL}/api/logs/store" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d "$BODY")

echo "Result: $RESULT"
