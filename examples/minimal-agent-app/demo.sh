#!/usr/bin/env bash
# minimal-agent-app demo — cstl init → validate-rules → list tree
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKSPACE="$SCRIPT_DIR/_demo-workspace"

resolve_cstl() {
  local built="$REPO_ROOT/packages/cli/bin/cstl.js"
  if [[ -f "$built" ]]; then
    if [[ ! -f "$REPO_ROOT/packages/cli/dist/cli/index.js" ]]; then
      echo "Building CLI from monorepo..."
      (cd "$REPO_ROOT" && pnpm build)
    fi
    echo "$built"
    return
  fi
  if command -v cstl >/dev/null 2>&1; then
    command -v cstl
    return
  fi
  echo "Error: cstl not found. Install: npm install -g @blxzer/cursor-trellis" >&2
  echo "Or run from cursor-trellis repo after pnpm build." >&2
  exit 1
}

CSTL="$(resolve_cstl)"
echo "Using CLI: $CSTL"

rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

echo ""
echo "==> cstl init --cursor -y"
node "$CSTL" init --cursor -y

echo ""
echo "==> cstl validate-rules"
node "$CSTL" validate-rules

echo ""
echo "==> Generated layout ($WORKSPACE)"
if command -v tree >/dev/null 2>&1; then
  tree -L 2 -a --dirsfirst
else
  find . -maxdepth 2 \( -name .cstl -o -name .cursor -o -name AGENTS.md \) -print | sort
  echo ""
  echo ".cstl/"
  ls -1 .cstl 2>/dev/null || true
  echo ""
  echo ".cursor/"
  ls -1 .cursor 2>/dev/null || true
fi

echo ""
echo "Done. Open $WORKSPACE in Cursor to continue with /cstl-continue."
