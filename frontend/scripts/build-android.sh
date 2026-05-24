#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# build-android.sh  —  One command to build the Android APK / AAB
#
# Usage:
#   chmod +x scripts/build-android.sh
#   ./scripts/build-android.sh          # debug APK (for testing)
#   ./scripts/build-android.sh release  # release AAB (for Play Store)
#
# Requirements:
#   • Node.js + npm
#   • Android Studio (with SDK & JDK 17)
#   • ANDROID_HOME env var set  (e.g. ~/Library/Android/sdk)
# ─────────────────────────────────────────────────────────────────────────────

set -e

MODE=${1:-debug}
FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   St. Paul's School ERP — Android Build Script    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "▶ Mode: $MODE"
echo "▶ Dir:  $FRONTEND_DIR"
echo ""

cd "$FRONTEND_DIR"

# ── Auto-detect Android Studio Bundled Java (macOS) ──────────────────────────
if [ -z "$JAVA_HOME" ]; then
  AS_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  if [ -d "$AS_JBR" ]; then
    export JAVA_HOME="$AS_JBR"
    echo "☕ Using Android Studio Bundled JDK: $JAVA_HOME"
  else
    echo "⚠️  WARNING: JAVA_HOME is not set and Android Studio JDK not found."
  fi
fi
echo ""

# ── Step 1: Build React app ───────────────────────────────────────────────────
echo "━━━ [1/4] Building React web app…"
DISABLE_ESLINT_PLUGIN=true npm run build
echo "✅  React build complete"
echo ""

# ── Step 2: Sync Capacitor ───────────────────────────────────────────────────
echo "━━━ [2/4] Syncing Capacitor…"
npx cap sync android
echo "✅  Capacitor sync complete"
echo ""

# ── Step 3: Build Android ────────────────────────────────────────────────────
echo "━━━ [3/4] Building Android ($MODE)…"
cd android

if [ "$MODE" = "release" ]; then
  echo "   Building release AAB (Bundle for Play Store)…"
  ./gradlew bundleRelease --quiet
  OUT="app/build/outputs/bundle/release/app-release.aab"
  echo "✅  AAB created: android/$OUT"
  echo ""
  echo "⚠️  NEXT — Sign your AAB:"
  echo "   1. Create a keystore if you don't have one:"
  echo "      keytool -genkey -v -keystore stpauls-release.jks \\"
  echo "              -alias stpauls -keyalg RSA -keysize 2048 -validity 10000"
  echo ""
  echo "   2. Sign the AAB:"
  echo "      jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \\"
  echo "        -keystore stpauls-release.jks $OUT stpauls"
  echo ""
  echo "   3. Upload to Google Play Console → Production / Internal Testing"
else
  echo "   Building debug APK (for direct install & testing)…"
  ./gradlew assembleDebug --quiet
  OUT="app/build/outputs/apk/debug/app-debug.apk"
  echo ""
  echo "✅  APK created: android/$OUT"
  echo ""
  echo "📱 Install on connected device:"
  echo "   adb install android/$OUT"
fi

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║               Build finished! 🎉                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
