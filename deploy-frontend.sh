#!/bin/bash
# ─── St. Paul's ERP — Frontend Deploy Script ──────────────────────────────────
# Usage: ./deploy-frontend.sh
# Builds the React app and deploys it to Firebase Hosting.

set -e  # Stop on any error

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo ""
echo "🏫  St. Paul's High School ERP — Frontend Deployer"
echo "────────────────────────────────────────────────────"

# Step 1: Build
echo ""
echo "📦  Step 1/2 — Building React app..."
cd "$FRONTEND_DIR"
npm run build

# Step 2: Deploy
echo ""
echo "🚀  Step 2/2 — Deploying to Firebase Hosting..."
cd "$PROJECT_ROOT"
npx -y firebase-tools@latest deploy --only storage,hosting --project stpauls-erp

echo ""
echo "✅  Done! Your app is live at:"
echo "    👉  https://stpauls-erp.web.app"
echo ""
