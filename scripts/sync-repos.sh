#!/usr/bin/env bash
# Vendors upstream source under repos/ with git subtree so agents can read it.
# First run adds the subtree; later runs pull updates. Needs at least one commit.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

sync() {
  local prefix="$1" url="$2" ref="$3"

  if [ -d "$prefix" ]; then
    git subtree pull --prefix="$prefix" "$url" "$ref" --squash
  else
    git subtree add --prefix="$prefix" "$url" "$ref" --squash
  fi
}

sync repos/effect https://github.com/Effect-TS/effect.git main
