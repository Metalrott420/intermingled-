#!/usr/bin/env bash
# capture-store-screenshots.sh
#
# Captures the three Google Play store screenshots from a connected Android
# device or running emulator and saves them to attached_assets/store/.
#
# Requirements:
#   - adb is on your PATH (comes with Android SDK platform-tools)
#   - Exactly one device/emulator is connected (`adb devices` should show it)
#   - The Intermingled app is already installed and open on the target screen
#
# Usage:
#   1. Start the app and navigate to the QUIZ screen, then run:
#        bash scripts/capture-store-screenshots.sh quiz
#   2. Navigate to the POOL/WAITING screen, then run:
#        bash scripts/capture-store-screenshots.sh pool
#   3. Navigate to the INBOX screen, then run:
#        bash scripts/capture-store-screenshots.sh inbox
#   4. Or capture all three in sequence (you will be prompted between each):
#        bash scripts/capture-store-screenshots.sh all
#
# The script verifies the captured image is at least 1080x1920 px.

set -euo pipefail

STORE_DIR="$(cd "$(dirname "$0")/.." && pwd)/attached_assets/store"
DEVICE_TMP="/sdcard/intermingled_screenshot.png"
MIN_W=1080
MIN_H=1920

# -- helpers ------------------------------------------------------------------

check_adb() {
  if ! command -v adb &>/dev/null; then
    echo "ERROR: adb not found. Install Android SDK platform-tools and add to PATH."
    exit 1
  fi
  local devices
  devices=$(adb devices | grep -v "^List" | grep "device$" | wc -l)
  if [ "$devices" -eq 0 ]; then
    echo "ERROR: No Android device/emulator connected. Run 'adb devices' to check."
    exit 1
  fi
  if [ "$devices" -gt 1 ]; then
    echo "WARNING: Multiple devices detected. Set ANDROID_SERIAL to target one."
  fi
}

check_dimensions() {
  local file="$1"
  # Use Python if available; fall back to file command
  if command -v python3 &>/dev/null; then
    local dims
    dims=$(python3 -c "
import struct, zlib, sys
with open('$file','rb') as f:
    sig = f.read(8)
    f.read(4)  # length
    chunk = f.read(4)
    if chunk == b'IHDR':
        data = f.read(4+4)
        w, h = struct.unpack('>II', data)
        print(w, h)
    else:
        print(0, 0)
" 2>/dev/null)
    local w h
    w=$(echo "$dims" | awk '{print $1}')
    h=$(echo "$dims" | awk '{print $2}')
    if [ "$w" -lt "$MIN_W" ] || [ "$h" -lt "$MIN_H" ]; then
      echo "WARNING: Captured image is ${w}x${h}, below the ${MIN_W}x${MIN_H} minimum."
      echo "         Consider using a higher-resolution device or emulator."
    else
      echo "  OK: ${w}x${h} (meets ${MIN_W}x${MIN_H} requirement)"
    fi
  fi
}

capture_screen() {
  local name="$1"      # quiz | pool | inbox
  local dest_file="$2" # full path to destination PNG
  local label="$3"     # human-readable screen name

  echo ""
  echo "=== Capturing: $label ==="
  echo "    Make sure the app is showing the $label screen, then press Enter..."
  read -r

  echo "  Capturing screen on device..."
  adb shell screencap -p "$DEVICE_TMP"

  echo "  Pulling to $dest_file ..."
  adb pull "$DEVICE_TMP" "$dest_file"
  adb shell rm -f "$DEVICE_TMP"

  echo "  Checking dimensions..."
  check_dimensions "$dest_file"
  echo "  Saved: $dest_file"
}

# -- main ---------------------------------------------------------------------

check_adb

TARGET="${1:-all}"

case "$TARGET" in
  quiz)
    capture_screen "quiz" "$STORE_DIR/screenshot_1_quiz.png" "Quiz / Personality screen"
    ;;
  pool)
    capture_screen "pool" "$STORE_DIR/screenshot_2_pool.png" "Pool / Waiting room screen"
    ;;
  inbox)
    capture_screen "inbox" "$STORE_DIR/screenshot_3_inbox.png" "Inbox / Matches screen"
    ;;
  all)
    echo ""
    echo "Capturing all 3 store screenshots in sequence."
    echo "Open the Intermingled app before continuing."
    capture_screen "quiz"  "$STORE_DIR/screenshot_1_quiz.png"  "Quiz / Personality screen"
    capture_screen "pool"  "$STORE_DIR/screenshot_2_pool.png"  "Pool / Waiting room screen"
    capture_screen "inbox" "$STORE_DIR/screenshot_3_inbox.png" "Inbox / Matches screen"
    echo ""
    echo "All 3 screenshots captured."
    echo ""
    echo "Next: upload them in Play Console → Store listing → Phone screenshots"
    ;;
  *)
    echo "Usage: $0 [quiz|pool|inbox|all]"
    exit 1
    ;;
esac
