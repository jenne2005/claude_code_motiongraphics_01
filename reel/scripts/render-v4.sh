#!/usr/bin/env bash
# ReelV4 delivery: Remotion high-quality intermediate -> H.264 High, yuv420p (limited range),
# ~12 Mbps, AAC 256k, +faststart.  Usage (from repo root): bash reel/scripts/render-v4.sh [A B C]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out ../out
for v in "${@:-A B C}"; do
  for h in $v; do
    npx remotion render src/index.ts "HungrillzV4$h" "out/v4-$h.master.mp4" --codec=h264 --crf=12 --audio-codec=aac --audio-bitrate=256k --concurrency=4
    ffmpeg -y -loglevel error -i "out/v4-$h.master.mp4" \
      -vf "scale=in_range=pc:out_range=tv,format=yuv420p" -c:v libx264 -profile:v high -preset slow \
      -b:v 12M -maxrate 15M -bufsize 24M -c:a copy -movflags +faststart "../out/hungrillz-v4-$h.mp4"
    echo "wrote out/hungrillz-v4-$h.mp4"
  done
done
