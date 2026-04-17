#!/bin/bash
# Pre-commit checks — local subset of CI
# Runs: format check, lint, typecheck, tests (without DB)
# DB-dependent tests are skipped locally and run in GitHub Actions CI

set -e

cd "$(git rev-parse --show-toplevel)"

echo "🔍 Running pre-commit checks..."

echo ""
echo "1/4 Format check..."
pnpm prettier --check . 2>&1 || {
  echo "❌ Format check failed. Run 'pnpm format' to fix."
  exit 1
}

echo ""
echo "2/4 Lint..."
pnpm turbo lint 2>&1 || {
  echo "❌ Lint failed."
  exit 1
}

echo ""
echo "3/4 Typecheck..."
pnpm turbo typecheck 2>&1 || {
  echo "❌ Typecheck failed."
  exit 1
}

echo ""
echo "4/4 Tests (non-DB)..."
DATABASE_URL= pnpm turbo test 2>&1 || {
  echo "❌ Tests failed."
  exit 1
}

echo ""
echo "✅ All local checks passed. DB-dependent tests will run in CI."
