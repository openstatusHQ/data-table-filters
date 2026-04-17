#!/bin/bash
# Post-commit check: warn if registry source was modified but not rebuilt
# Compares git diff of staged + unstaged changes against last registry build output

cd "$(git rev-parse --show-toplevel)"

# Check if any registry source files have uncommitted changes
registry_changed=$(git diff --name-only HEAD 2>/dev/null | grep -c "^packages/registry/src/" || true)

if [ "$registry_changed" -gt 0 ]; then
  echo "⚠️  Registry source files changed. Run 'pnpm registry:build' and commit the output."
  exit 1
fi

exit 0
