#!/usr/bin/env bash
# Detect the user's project setup for data-table-filters integration.
# Run from the project root. Outputs a structured summary.

set -euo pipefail

echo "=== data-table-filters: Stack Detection ==="
echo ""

# Package manager
if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
  PKG_MGR="bun"
elif [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm"
elif [ -f "yarn.lock" ]; then
  PKG_MGR="yarn"
else
  PKG_MGR="npm"
fi
echo "Package manager: $PKG_MGR"

# Framework
FRAMEWORK="unknown"
if [ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ]; then
  FRAMEWORK="next"
  if [ -d "app" ] || [ -d "src/app" ]; then
    FRAMEWORK="next-app-router"
  elif [ -d "pages" ] || [ -d "src/pages" ]; then
    FRAMEWORK="next-pages-router"
  fi
elif [ -f "vite.config.ts" ] || [ -f "vite.config.js" ]; then
  FRAMEWORK="vite"
elif [ -f "remix.config.js" ] || [ -f "remix.config.ts" ]; then
  FRAMEWORK="remix"
elif [ -f "astro.config.mjs" ] || [ -f "astro.config.ts" ]; then
  FRAMEWORK="astro"
fi
echo "Framework: $FRAMEWORK"

# Tailwind version
TW_VERSION="unknown"
if [ -f "package.json" ]; then
  TW_V=$(grep -o '"tailwindcss": *"[^"]*"' package.json 2>/dev/null | grep -o '[0-9][^"]*' || true)
  if [ -n "$TW_V" ]; then
    case "$TW_V" in
      4*) TW_VERSION="v4" ;;
      3*) TW_VERSION="v3" ;;
      *) TW_VERSION="v$TW_V" ;;
    esac
  fi
fi
echo "Tailwind: $TW_VERSION"

# shadcn/ui
SHADCN="not initialized"
if [ -f "components.json" ]; then
  SHADCN="initialized"
  SHADCN_COMPONENTS=""
  if [ -d "src/components/ui" ]; then
    SHADCN_COMPONENTS=$(ls src/components/ui/ 2>/dev/null | sed 's/\.tsx$//' | tr '\n' ', ' | sed 's/,$//')
  elif [ -d "components/ui" ]; then
    SHADCN_COMPONENTS=$(ls components/ui/ 2>/dev/null | sed 's/\.tsx$//' | tr '\n' ', ' | sed 's/,$//')
  fi
fi
echo "shadcn/ui: $SHADCN"
[ -n "${SHADCN_COMPONENTS:-}" ] && echo "  Components: $SHADCN_COMPONENTS"

# ORM
ORM="none"
if grep -q '"drizzle-orm"' package.json 2>/dev/null; then
  ORM="drizzle"
elif grep -q '"prisma"' package.json 2>/dev/null || grep -q '"@prisma/client"' package.json 2>/dev/null; then
  ORM="prisma"
fi
echo "ORM: $ORM"

# State management (already installed?)
STATE=""
if grep -q '"nuqs"' package.json 2>/dev/null; then
  STATE="${STATE}nuqs "
fi
if grep -q '"zustand"' package.json 2>/dev/null; then
  STATE="${STATE}zustand "
fi
echo "State libs: ${STATE:-none}"

# data-table-filters already installed?
DTF="not installed"
if [ -d "src/components/data-table" ] || [ -d "components/data-table" ]; then
  DTF="installed"
  DTF_COMPONENTS=""
  DIR="src/components/data-table"
  [ ! -d "$DIR" ] && DIR="components/data-table"
  if [ -d "$DIR" ]; then
    [ -f "$DIR/data-table-infinite.tsx" ] && DTF_COMPONENTS="${DTF_COMPONENTS}core "
    [ -d "$DIR/data-table-filter-command" ] && DTF_COMPONENTS="${DTF_COMPONENTS}command "
    [ -d "$DIR/data-table-cell" ] && DTF_COMPONENTS="${DTF_COMPONENTS}cells "
    [ -d "$DIR/data-table-sheet" ] && DTF_COMPONENTS="${DTF_COMPONENTS}sheet "
  fi
  [ -d "src/lib/store/adapters/nuqs" ] && DTF_COMPONENTS="${DTF_COMPONENTS}nuqs-adapter "
  [ -d "src/lib/store/adapters/zustand" ] && DTF_COMPONENTS="${DTF_COMPONENTS}zustand-adapter "
  [ -d "src/lib/table-schema" ] && DTF_COMPONENTS="${DTF_COMPONENTS}schema "
  [ -d "src/lib/drizzle" ] && DTF_COMPONENTS="${DTF_COMPONENTS}drizzle "
fi
echo "data-table-filters: $DTF"
[ -n "${DTF_COMPONENTS:-}" ] && echo "  Blocks: $DTF_COMPONENTS"

echo ""
echo "=== Detection complete ==="
