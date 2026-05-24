#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-icons.sh — Generate all required icon sizes for Android & PWA
#
# Requirements: imagemagick (brew install imagemagick)
#
# Run from the frontend/ directory:
#   chmod +x scripts/generate-icons.sh
#   ./scripts/generate-icons.sh
#
# Place your master icon (1024×1024 px) at: src/assets/icon-master.png
# ─────────────────────────────────────────────────────────────────────────────

set -e

MASTER="src/assets/icon-master.png"
PWA_DIR="public/icons"
ANDROID_DIR="android/app/src/main/res"

# Check if master icon exists
if [ ! -f "$MASTER" ]; then
  echo "⚠️  Master icon not found at $MASTER"
  echo "   Creating a placeholder icon using ImageMagick…"
  mkdir -p src/assets
  convert -size 1024x1024 \
    gradient:'#4f46e5-#7c3aed' \
    -gravity Center \
    -font Helvetica-Bold \
    -pointsize 300 \
    -fill white \
    -annotate 0 'SP' \
    "$MASTER"
  echo "✅ Placeholder icon created at $MASTER"
fi

echo "🎨 Generating PWA icons…"
mkdir -p "$PWA_DIR"

for SIZE in 72 96 128 144 152 192 384 512; do
  convert "$MASTER" -resize "${SIZE}x${SIZE}" "$PWA_DIR/icon-${SIZE}x${SIZE}.png"
  echo "   ✓ ${SIZE}x${SIZE}"
done

echo ""
echo "🤖 Generating Android icons…"

# Android icon densities (mipmap folders)
declare -A ANDROID_SIZES=(
  ["mipmap-mdpi"]=48
  ["mipmap-hdpi"]=72
  ["mipmap-xhdpi"]=96
  ["mipmap-xxhdpi"]=144
  ["mipmap-xxxhdpi"]=192
)

for FOLDER in "${!ANDROID_SIZES[@]}"; do
  SIZE="${ANDROID_SIZES[$FOLDER]}"
  DEST="$ANDROID_DIR/$FOLDER"
  mkdir -p "$DEST"
  convert "$MASTER" -resize "${SIZE}x${SIZE}" "$DEST/ic_launcher.png"
  # Rounded version for adaptive icons
  convert "$MASTER" -resize "${SIZE}x${SIZE}" \
    \( +clone -alpha extract \
       -draw "fill black polygon 0,0 0,${SIZE} ${SIZE},${SIZE} ${SIZE},0 \
              fill white circle $((SIZE/2)),$((SIZE/2)) $((SIZE/2)),0" \
       \( +clone -flip \) -compose Multiply -composite \
       \( +clone -flop \) -compose Multiply -composite \
    \) -alpha off -compose CopyOpacity -composite \
    "$DEST/ic_launcher_round.png" 2>/dev/null || \
    convert "$MASTER" -resize "${SIZE}x${SIZE}" "$DEST/ic_launcher_round.png"
  echo "   ✓ $FOLDER (${SIZE}x${SIZE})"
done

echo ""
echo "📱 Generating Android splash screen…"
SPLASH_DIR="$ANDROID_DIR/drawable"
mkdir -p "$SPLASH_DIR"
convert -size 1920x1080 gradient:'#4f46e5-#7c3aed' \
  "$MASTER" -gravity Center -resize 400x400 -composite \
  "$SPLASH_DIR/splash.png"
echo "   ✓ splash.png"

echo ""
echo "🎉 All icons generated successfully!"
echo ""
echo "Next: Run  npm run build:android  to build the Android app"
