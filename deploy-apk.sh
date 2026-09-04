#!/bin/bash
# ─── St. Paul's ERP — Android APK Builder & Deployer ──────────────────────────
# Usage: ./deploy-apk.sh
# Synchronizes Capacitor, compiles APKs via Gradle, and copies them to Desktop.

set -e  # Stop on any error
export LANG=en_US.UTF-8

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"

# Force Gradle to use Android Studio's embedded JDK 21 (fixes Java 21 class major version compatibility)
if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  echo "☕  Using Android Studio's embedded JDK 21: $JAVA_HOME"
fi

echo ""
echo "📱  St. Paul's High School ERP — Android APK Builder"
echo "────────────────────────────────────────────────────"

# Step 1: Copy and Sync Web Assets
echo ""
echo "🔄  Step 1/3 — Copying and Syncing Web Assets with Capacitor..."
cd "$FRONTEND_DIR"
npx cap copy
npx cap sync

# Step 2: Build Debug, Release APKs, and Release AAB
echo ""
echo "🏗️  Step 2/3 — Compiling Android Project with Gradle..."
cd "$ANDROID_DIR"
./gradlew assembleDebug assembleRelease bundleRelease

# Step 3: Copy to Desktop
echo ""
echo "📤  Step 3/3 — Deploying APKs & AAB to Desktop..."
# cp app/build/outputs/apk/debug/app-debug.apk ~/Desktop/StPaulsERP_debug.apk
cp app/build/outputs/apk/release/app-release.apk ~/Desktop/StPaulsERP_release.apk
cp app/build/outputs/bundle/release/app-release.aab ~/Desktop/StPaulsERP_release.aab

echo ""
echo "✅  Build & Deploy Successful!"
echo "────────────────────────────────────────────────────"
# echo "    👉  Debug APK:   ~/Desktop/StPaulsERP_debug.apk"
echo "    👉  Release APK: ~/Desktop/StPaulsERP_release.apk"
echo "    👉  Release AAB: ~/Desktop/StPaulsERP_release.aab"
echo ""
echo "📊  File Details:"
ls -lh ~/Desktop/StPaulsERP_release.apk ~/Desktop/StPaulsERP_release.aab
echo ""
