#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.cargo/env"
fi

case "${1:-build}" in
  build)
    wasm-pack build packages/xlsx-pdf-core --target web --release \
      --out-dir ../../src/libs/wasm/xlsx-pdf-core
    # wasm-pack marks its output directory with a catch-all .gitignore and
    # copies the crate README. The generated package is committed instead.
    rm -f src/libs/wasm/xlsx-pdf-core/.gitignore src/libs/wasm/xlsx-pdf-core/README.md
    ;;
  test)
    cargo test --manifest-path packages/xlsx-pdf-core/Cargo.toml
    ;;
  *)
    echo "usage: $0 [build|test]" >&2
    exit 1
    ;;
esac
