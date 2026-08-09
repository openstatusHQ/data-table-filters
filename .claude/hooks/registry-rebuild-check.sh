#!/bin/bash
# PreToolUse check: block a commit whose registry output no longer matches the
# source it was built from. See lib/registry-stale.mjs for how staleness is
# determined — it compares built content, not "did src change at all".

source "$(dirname "$0")/lib/gate-git-commit.sh"

cd "$(git rev-parse --show-toplevel)"

exec node .claude/hooks/lib/registry-stale.mjs
