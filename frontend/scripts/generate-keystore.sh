#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-keystore.sh  —  Create a release signing keystore for Play Store
#
# Run ONCE before your first Play Store release:
#   chmod +x scripts/generate-keystore.sh
#   ./scripts/generate-keystore.sh
#
# ⚠️  IMPORTANT: Keep stpauls-release.jks and its passwords SAFE.
#    If you lose it, you can NEVER update your Play Store app.
#    Back it up to a secure location (e.g. encrypted drive, password manager).
# ─────────────────────────────────────────────────────────────────────────────

set -e

KEYSTORE_FILE="android/stpauls-release.jks"
ALIAS="stpauls"

if [ -f "$KEYSTORE_FILE" ]; then
  echo "⚠️  Keystore already exists at $KEYSTORE_FILE"
  echo "   Delete it first if you want to regenerate."
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   St. Paul's School ERP — Play Store Keystore Setup  ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "You will be prompted to enter:"
echo "  • Keystore password (remember this!)"
echo "  • Your name, organisation, city, state, country"
echo ""

keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=St. Pauls School, OU=ERP, O=St. Pauls School, L=Hyderabad, ST=Telangana, C=IN"

echo ""
echo "✅  Keystore created: $KEYSTORE_FILE"
echo ""
echo "Now add signing config to android/app/build.gradle:"
echo ""
echo "   android {"
echo "     signingConfigs {"
echo "       release {"
echo "         storeFile file('stpauls-release.jks')"
echo "         storePassword 'YOUR_STORE_PASSWORD'"
echo "         keyAlias 'stpauls'"
echo "         keyPassword 'YOUR_KEY_PASSWORD'"
echo "       }"
echo "     }"
echo "     buildTypes {"
echo "       release {"
echo "         signingConfig signingConfigs.release"
echo "       }"
echo "     }"
echo "   }"
echo ""
echo "Then run:  ./scripts/build-android.sh release"
