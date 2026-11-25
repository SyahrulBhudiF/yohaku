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
    wasm-pack build packages/background-removal-core --target web --release \
      --out-dir ../../src/libs/wasm/background-removal-core
    wasm-pack build packages/image-pdf-core --target web --release \
      --out-dir ../../src/libs/wasm/image-pdf-core
    wasm-pack build packages/word-pdf-core --target web --release \
      --out-dir ../../src/libs/wasm/word-pdf-core
    wasm-pack build packages/pptx-pdf-core --target web --release \
      --out-dir ../../src/libs/wasm/pptx-pdf-core
    wasm-pack build packages/social-media-core --target web --release \
      --out-dir ../../src/libs/wasm/social-media-core
    # wasm-pack marks its output directory with a catch-all .gitignore and
    # copies the crate README. The generated packages are committed instead.
    rm -f src/libs/wasm/xlsx-pdf-core/.gitignore src/libs/wasm/xlsx-pdf-core/README.md
    rm -f src/libs/wasm/background-removal-core/.gitignore src/libs/wasm/background-removal-core/README.md
    rm -f src/libs/wasm/image-pdf-core/.gitignore src/libs/wasm/image-pdf-core/README.md
    rm -f src/libs/wasm/word-pdf-core/.gitignore src/libs/wasm/word-pdf-core/README.md
    rm -f src/libs/wasm/pptx-pdf-core/.gitignore src/libs/wasm/pptx-pdf-core/README.md
    rm -f src/libs/wasm/social-media-core/.gitignore src/libs/wasm/social-media-core/README.md
    ;;
  test)
    for manifest in packages/*/Cargo.toml; do
      cargo fmt --manifest-path "$manifest" --check
      cargo test --locked --manifest-path "$manifest"
    done
    ;;
  *)
    echo "usage: $0 [build|test]" >&2
    exit 1
    ;;
esac
