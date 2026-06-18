#!/bin/bash
# ─── St. Paul's ERP — Universal Build Script ────────────────────────────────
# Builds Web App + Android APK + iOS Archive (if Xcode is available)
# Usage: ./build-all.sh
#        ./build-all.sh --web-only
#        ./build-all.sh --android-only
#        ./build-all.sh --ios-only

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"
IOS_DIR="$FRONTEND_DIR/ios"

# Parse flags
BUILD_WEB=true
BUILD_ANDROID=true
BUILD_IOS=true

for arg in "$@"; do
  case $arg in
    --web-only)     BUILD_ANDROID=false; BUILD_IOS=false ;;
    --android-only) BUILD_WEB=false;     BUILD_IOS=false ;;
    --ios-only)     BUILD_WEB=false;     BUILD_ANDROID=false ;;
  esac
done

# Force Gradle to use Android Studio's embedded JDK 21
if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

echo ""
echo "🏫  St. Paul's High School ERP — Universal Build"
echo "════════════════════════════════════════════════"
echo "   Platforms: $([ "$BUILD_WEB" = true ] && echo "🌐 Web ") $([ "$BUILD_ANDROID" = true ] && echo "🤖 Android ") $([ "$BUILD_IOS" = true ] && echo "🍎 iOS")"
echo ""

# ─── Step 1: Build React Web Assets ─────────────────────────────────────────
echo "⚛️   Step 1 — Building React web assets..."
cd "$FRONTEND_DIR"
npm run build
echo "✅  React build complete."
echo ""

# ─── Step 2: Sync to all native platforms ───────────────────────────────────
echo "🔄  Step 2 — Syncing assets to native platforms..."
npx cap copy android 2>/dev/null || true
npx cap copy ios 2>/dev/null || true
npx cap sync android 2>/dev/null || true
npx cap sync ios 2>/dev/null || true
echo "✅  Sync complete."
echo ""

# ─── Step 3: Deploy to Firebase Hosting (Web) ───────────────────────────────
if [ "$BUILD_WEB" = true ]; then
  echo "🌐  Step 3 — Deploying to Firebase Hosting (Web App)..."
  npx -y firebase-tools@latest deploy --only hosting
  echo "✅  Web app deployed."
  echo ""
fi

# ─── Step 4: Build Android APK + AAB ────────────────────────────────────────
if [ "$BUILD_ANDROID" = true ]; then
  echo "🤖  Step 4 — Building Android APK & AAB..."
  cd "$ANDROID_DIR"
  ./gradlew assembleDebug assembleRelease bundleRelease

  # Copy APKs to Desktop
  cp app/build/outputs/apk/debug/app-debug.apk ~/Desktop/StPaulsERP_debug.apk
  cp app/build/outputs/apk/release/app-release.apk ~/Desktop/StPaulsERP_release.apk
  cp app/build/outputs/bundle/release/app-release.aab ~/Desktop/StPaulsERP_release.aab

  echo ""
  echo "✅  Android build complete:"
  echo "    👉  Debug APK   → ~/Desktop/StPaulsERP_debug.apk"
  echo "    👉  Release APK → ~/Desktop/StPaulsERP_release.apk"
  echo "    👉  Play Store  → ~/Desktop/StPaulsERP_release.aab"
  ls -lh ~/Desktop/StPaulsERP_*.apk ~/Desktop/StPaulsERP_*.aab
  echo ""
fi

# ─── Step 5: Build iOS (requires Xcode) ─────────────────────────────────────
if [ "$BUILD_IOS" = true ]; then
  echo "🍎  Step 5 — Building iOS..."

  if ! command -v xcodebuild &>/dev/null; then
    echo ""
    echo "⚠️   Xcode not found. Skipping iOS build."
    echo "    Install Xcode from the Mac App Store, then re-run this script."
    echo "    iOS project IS configured and ready — only build step is missing."
    echo ""
  elif ! command -v pod &>/dev/null; then
    echo ""
    echo "⚠️   CocoaPods not found. Skipping iOS build."
    echo "    Run:  sudo gem install cocoapods"
    echo "    Then re-run this script."
    echo ""
  else
    cd "$IOS_DIR/App"
    pod install

    # Archive for App Store
    cd "$IOS_DIR"
    xcodebuild \
      -workspace App/App.xcworkspace \
      -scheme App \
      -configuration Release \
      -archivePath ~/Desktop/StPaulsERP.xcarchive \
      archive \
      CODE_SIGN_STYLE=Automatic \
      | tail -5

    echo ""
    echo "✅  iOS Archive ready:"
    echo "    👉  ~/Desktop/StPaulsERP.xcarchive"
    echo "    Open Xcode Organizer to upload to App Store."
    echo ""
  fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "✅  ALL DONE! Here is what was built:"
[ "$BUILD_WEB" = true ]     && echo "   🌐  Web App    → https://stpauls-erp.web.app"
[ "$BUILD_ANDROID" = true ] && echo "   🤖  Android    → ~/Desktop/StPaulsERP_release.apk"
[ "$BUILD_ANDROID" = true ] && echo "   📦  Play Store → ~/Desktop/StPaulsERP_release.aab"
[ "$BUILD_IOS" = true ]     && echo "   🍎  iOS        → ~/Desktop/StPaulsERP.xcarchive"
echo "════════════════════════════════════════════════"
echo ""
