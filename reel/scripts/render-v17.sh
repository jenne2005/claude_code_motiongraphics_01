#!/usr/bin/env bash
# v1.7 delivery: Remotion high-quality master -> H.264 High, yuv420p (limited range), ~12 Mbps,
# AAC 256k, +faststart.  Usage (from repo root): bash reel/scripts/render-v17.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out ../out
npx remotion render src/index.ts HungrillzV17 out/v17.master.mp4 --codec=h264 --crf=12 --audio-codec=aac --audio-bitrate=256k --concurrency=100%
ffmpeg -y -loglevel error -i out/v17.master.mp4 \
  -vf "scale=in_range=pc:out_range=tv,format=yuv420p" -c:v libx264 -profile:v high -preset slow \
  -b:v 12M -maxrate 15M -bufsize 24M -c:a copy -movflags +faststart ../out/hungrillz-v17.mp4
npx remotion still src/index.ts HungrillzV17Cover ../out/cover.png
echo "wrote out/hungrillz-v17.mp4 and out/cover.png"
