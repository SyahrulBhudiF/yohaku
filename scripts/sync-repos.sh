#!/usr/bin/env bash
# Clones upstream source under repos/ (gitignored) so agents can read it.
# First run clones; later runs update to the latest commit.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

sync() {
  local dir="$1" url="$2" ref="$3"

  if [ -d "$dir/.git" ]; then
    git -C "$dir" fetch --depth 1 origin "$ref"
    git -C "$dir" reset --hard FETCH_HEAD
  else
    git clone --depth 1 --branch "$ref" "$url" "$dir"
  fi
}

sync repos/effect https://github.com/Effect-TS/effect.git main
