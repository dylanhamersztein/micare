#!/usr/bin/env bash
# Download the SSD-MobileNet-v1 weights @vladmandic/face-api uses for face
# detection. Models are checked into public/face-api-models/ so production
# bundles them rather than fetching at boot. Idempotent — re-runs are a no-op
# when the files already exist.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="$repo_root/public/face-api-models"
mkdir -p "$dest"

base='https://raw.githubusercontent.com/vladmandic/face-api/master/model'
for f in \
  ssd_mobilenetv1_model-weights_manifest.json \
  ssd_mobilenetv1_model.bin; do
  if [[ ! -f "$dest/$f" ]]; then
    echo "Downloading $f"
    curl -fsSL "$base/$f" -o "$dest/$f"
  else
    echo "Have $f"
  fi
done
