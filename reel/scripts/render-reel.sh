#!/usr/bin/env bash
# Final render: Remotion (H.264 + AAC, 1080x1920, 30fps) -> two-pass ffmpeg loudnorm to -14 LUFS.
# Usage (from repo root): bash reel/scripts/render-reel.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out ../out
npx remotion render src/index.ts HungrillzReel out/reel-raw.mp4 --codec=h264 --audio-codec=aac --crf=16 --concurrency=4
# pass 1: measure
M=$(ffmpeg -hide_banner -i out/reel-raw.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
# pass 2: linear normalisation, video stream copied untouched
ffmpeg -y -loglevel error -i out/reel-raw.mp4 -c:v copy \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart ../out/hungrillz-reel.mp4
echo "wrote out/hungrillz-reel.mp4"
